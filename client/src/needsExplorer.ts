'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface Needs {
	[need_id: string]: Need;
}

interface Need {
	id: string;
	description: string;
	docname: string;
	doctype: string;
	status: string;
	title: string;
	type: string;
}

interface SNVConfig {
	needsJson: string | undefined;
	srcDir: string | undefined;
	explorerOptions: string[] | undefined;
}

export class NeedsExplorerProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<NeedTree[] | undefined> = new vscode.EventEmitter<
		NeedTree[] | undefined
	>();
	readonly onDidChangeTreeData: vscode.Event<NeedTree[] | undefined> = this._onDidChangeTreeData.event;

	needsObjects: Needs = {};
	snvConfigs: SNVConfig;

	constructor() {
		// Get workspace configurations and init snvConfigs
		this.snvConfigs = this.getSNVConfigurations();

		// Get needs objects from needs.json and update needsObjects
		this.loadNeedsJson(this.snvConfigs.needsJson);

		// Create file watcher for needs.json
		this.watcher();

		// Listen to workspace configuration change event
		this.listenToChangeConfiguration();
	}

	private watcher(): void {
		// Create file watcher for needs.json
		if (this.snvConfigs.needsJson && this.pathExists(this.snvConfigs.needsJson)) {
			const watcher = vscode.workspace.createFileSystemWatcher(this.snvConfigs.needsJson);
			// Listen to change of watched needs.json
			watcher.onDidChange((e) => {
				// Update needs objects from needs.json
				this.loadNeedsJson(e.fsPath);
				// Update tree
				this._onDidChangeTreeData.fire(undefined);
			});
		}
	}

	private listenToChangeConfiguration(): void {
		vscode.workspace.onDidChangeConfiguration(() => {
			let updateTreeData = false;
			const newConfig = this.getSNVConfigurations();

			// Check if explorerOptions changed
			if (this.snvConfigs.explorerOptions !== newConfig.explorerOptions) {
				this.snvConfigs.explorerOptions = newConfig.explorerOptions;
				updateTreeData = true;
			}

			// Check if needsJson path got changed
			if (this.snvConfigs.needsJson !== newConfig.needsJson) {
				this.snvConfigs.needsJson = newConfig.needsJson;
				this.loadNeedsJson(this.snvConfigs.needsJson);
				updateTreeData = true;
				// Update watcher for new needs.json
				this.watcher();
			}

			// Check if srcDir changed
			if (this.snvConfigs.srcDir !== newConfig.srcDir) {
				this.snvConfigs.srcDir = newConfig.srcDir;
				updateTreeData = true;
			}

			// Update tree data
			if (updateTreeData) {
				this._onDidChangeTreeData.fire(undefined);
			}
		});
	}

	getChildren(element?: NeedTree | NeedOptionItem): Thenable<vscode.TreeItem[]> {
		if (!this.needsObjects) {
			return Promise.resolve([]);
		}

		if (!element) {
			// Root level
			return Promise.resolve(this.getNeedTree());
		}

		// Get and show need options
		if (element.id && element.id in this.needsObjects && this.snvConfigs.explorerOptions) {
			const optionItems: NeedOptionItem[] = [];
			this.snvConfigs.explorerOptions.forEach((option) => {
				if (element.id) {
					// check if option exists in needs.json
					if (option in this.needsObjects[element.id]) {
						for (const [need_option, op_value] of Object.entries(this.needsObjects[element.id])) {
							if (option === need_option) {
								optionItems.push(
									new NeedOptionItem(option, op_value, vscode.TreeItemCollapsibleState.None)
								);
							}
						}
					} else {
						console.warn(`Need option ${option} not exists for ${element.id}.`);
					}
				}
			});
			return Promise.resolve(optionItems);
		}
		return Promise.resolve([]);
	}

	getTreeItem(element: NeedTree): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element;
	}

	private getSNVConfigurations(): SNVConfig {
		// Get relevant configuration settings
		let needs_json_path: string | undefined = vscode.workspace.getConfiguration('sphinx-needs').get('needsJson');
		let confPyDir: string | undefined = vscode.workspace.getConfiguration('sphinx-needs').get('srcDir');
		const shownNeedOptions: string[] | undefined = vscode.workspace
			.getConfiguration('sphinx-needs')
			.get('explorerOptions');

		const workspaceFolderpath =
			vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
				? vscode.workspace.workspaceFolders[0].uri.fsPath
				: undefined;

		if (workspaceFolderpath) {
			needs_json_path = needs_json_path?.replace('${workspaceFolder}', workspaceFolderpath);
			confPyDir = confPyDir?.replace('${workspaceFolder}', workspaceFolderpath);
		}

		// Check if path exists of needsJson and srcDir
		if (!confPyDir) {
			console.warn(`SNV Explorer -> empty srcDir: ${confPyDir}`);
		}

		if (!needs_json_path) {
			console.warn(`SNV Explorer -> needsJson path not exists: ${needs_json_path}`);
		}

		return {
			needsJson: needs_json_path,
			srcDir: confPyDir,
			explorerOptions: shownNeedOptions
		};
	}

	private loadNeedsJson(needsJsonFilePath: string | undefined): void {
		// Check needs.json path and get needs object from needs.json if exists
		if (needsJsonFilePath && this.pathExists(needsJsonFilePath)) {
			// Read needs.json
			const needsJson = JSON.parse(fs.readFileSync(needsJsonFilePath, 'utf-8'));
			// Get needs objects from current_version
			const curr_version: string = needsJson['current_version'];
			this.needsObjects = needsJson['versions'][curr_version]['needs'];
		} else {
			this.needsObjects = {};
		}
	}

	private getNeedFilePath(need: Need): vscode.Uri {
		// Get file path of current need
		const curr_need: Need = this.needsObjects[need.id];

		// Check if docname and doctype exist in need object
		if (!('docname' in curr_need)) {
			console.warn(`SNV Explorer -> Option docname not exists in Need ${curr_need}`);
			return vscode.Uri.file('');
		}
		if (!('doctype' in curr_need)) {
			console.warn(`SNV Explorer -> Option doctype not exists in Need ${curr_need}`);
			return vscode.Uri.file('');
		}

		// Calculate doc path uri for current need
		let curr_need_file_path = '';
		if (this.snvConfigs.srcDir) {
			curr_need_file_path = path.resolve(this.snvConfigs.srcDir, curr_need.docname + curr_need.doctype);
			if (!this.pathExists(curr_need_file_path)) {
				console.warn(`SNV Explorer -> doc path for Need ${need.id} not exists: ${curr_need_file_path}`);
			}
		}
		const needFileUri: vscode.Uri = vscode.Uri.file(curr_need_file_path);
		return needFileUri;
	}

	private getNeedTree(): NeedTree[] {
		const needsItems: NeedTree[] = [];
		if (this.needsObjects) {
			Object.values(this.needsObjects).forEach((need) => {
				// Check if Need ID matches Need Objects key entry
				if (!(need['id'] in this.needsObjects)) {
					console.warn(`SNV Explorer -> Need object entry of ${need.id} not exits in given needs.json`);
				} else {
					const needItem = new NeedTree(need['id'], need['title'], vscode.TreeItemCollapsibleState.Collapsed);
					const needFileUri = this.getNeedFilePath(need);
					needItem.command = {
						command: 'sphinxNeedsExplorer.openFile',
						title: 'Open File',
						arguments: [needFileUri]
					};
					needsItems.push(needItem);
				}
			});
			return needsItems;
		} else {
			return [];
		}
	}

	private pathExists(p: string): boolean {
		try {
			fs.accessSync(p);
		} catch (err) {
			return false;
		}
		return true;
	}
}

class NeedTree extends vscode.TreeItem {
	constructor(
		public readonly id: string,
		private title: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState
	) {
		super(id, collapsibleState);
		// this.tooltip = `${this.id}--${this.title}`;
		this.tooltip = new vscode.MarkdownString(`${this.id}--${this.title}`, true);
		this.description = this.title;
	}
}

class NeedOptionItem extends vscode.TreeItem {
	constructor(
		private option: string,
		private value: string | string[],
		collapsibleState: vscode.TreeItemCollapsibleState
	) {
		super(option, collapsibleState);
		// this.tooltip = `${this.option}: ${this.value}`;
		this.tooltip = new vscode.MarkdownString(`${this.option}: ${this.value}`, true);
		this.description = this.value.toString();
	}
}
