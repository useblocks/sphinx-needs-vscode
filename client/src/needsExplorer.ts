'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LogLevel, TimeStampedLogger } from './logging';

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
	parent_need: string;
}

interface SNVConfig {
	needsJson: string | undefined;
	srcDir: string | undefined;
	explorerOptions: string[] | undefined;
	explorerItemHoverOptions: string[] | undefined;
	loggingLevel: LogLevel;
}

let tslogger: TimeStampedLogger;

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

	openNeedsJson(): void {
		// Open needsJson
		const need_json_path = this.snvConfigs.needsJson;
		if (need_json_path && this.pathExists(need_json_path)) {
			vscode.window.showTextDocument(vscode.Uri.file(need_json_path));
		}
	}

	openSettings(): void {
		// Open Settings of this extension
		vscode.commands.executeCommand('workbench.action.openSettings', 'sphinx-needs');
	}

	openSphinxNeedsOfficialDocs(): void {
		// Open Sphinx-Needs official docs in default external browser
		// vscode.env.openExternal(vscode.Uri.parse('https://sphinx-needs.readthedocs.io/en/latest/index.html'));

		// Open Sphinx-Needs official docs in internal simple browser inside vscode
		vscode.commands.executeCommand(
			'simpleBrowser.api.open',
			'https://sphinx-needs.readthedocs.io/en/latest/index.html'
		);
	}

	goToDefinition(item: NeedTree): void {
		vscode.workspace.openTextDocument(item.idLoc.uri).then((doc) => {
			vscode.window.showTextDocument(doc).then((editor) => {
				editor.selections = [new vscode.Selection(item.idLoc.range.start, item.idLoc.range.end)];
				editor.revealRange(item.idLoc.range, vscode.TextEditorRevealType.Default);
			});
		});
	}

	copyNeedID(item: NeedTree): void {
		vscode.env.clipboard.writeText(item.id);
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

			// Check if loggingLevel changed
			if (this.snvConfigs.loggingLevel !== newConfig.loggingLevel) {
				this.snvConfigs.loggingLevel = newConfig.loggingLevel;
				tslogger = new TimeStampedLogger(this.snvConfigs.loggingLevel);
			}

			// Check if explorerOptions changed
			if (this.snvConfigs.explorerOptions !== newConfig.explorerOptions) {
				this.snvConfigs.explorerOptions = newConfig.explorerOptions;
				updateTreeData = true;
			}

			// Check if explorerItemHoverOptions changed
			if (this.snvConfigs.explorerItemHoverOptions !== newConfig.explorerItemHoverOptions) {
				this.snvConfigs.explorerItemHoverOptions = newConfig.explorerItemHoverOptions;
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
									new NeedOptionItem(option + ': ' + op_value, vscode.TreeItemCollapsibleState.None)
								);
							}
						}
					} else {
						optionItems.push(new NeedOptionItem(option + ': None', vscode.TreeItemCollapsibleState.None));
						tslogger.warn(`Need option ${option} not exists for ${element.id}.`);
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
		const hoverNeedOptions: string[] | undefined = vscode.workspace
			.getConfiguration('sphinx-needs')
			.get('explorerItemHoverOptions');
		// Get logging level
		let logLevel: LogLevel | undefined = vscode.workspace.getConfiguration('sphinx-needs').get('loggingLevel');
		if (!logLevel) {
			logLevel = 'warn';
		}
		tslogger = new TimeStampedLogger(logLevel);

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
			explorerOptions: shownNeedOptions,
			explorerItemHoverOptions: hoverNeedOptions,
			loggingLevel: logLevel
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
			// Check and get doctype for nested child needs
			for (const need of Object.values(this.needsObjects)) {
				let temp_parent_id: string;
				let temp_parent: Need;
				// Get child need
				if (!need['doctype'] && need['parent_need']) {
					// search up to top parent need to get info of doctype
					temp_parent_id = need['parent_need'];
					temp_parent = this.needsObjects[temp_parent_id];
					while (temp_parent['parent_need']) {
						if (!temp_parent['parent_need']) {
							break;
						}
						temp_parent = this.needsObjects[temp_parent['parent_need']];
					}
					need['doctype'] = temp_parent['doctype'];
				}
			}
		} else {
			this.needsObjects = {};
		}
	}

	private getNeedFilePath(need: Need): vscode.Uri {
		// Get file path of current need
		const curr_need: Need = this.needsObjects[need.id];

		// Check if docname and doctype exist in need object
		if (!('docname' in curr_need)) {
			tslogger.warn(`SNV Explorer -> Option docname not exists in Need ${curr_need}`);
			return vscode.Uri.file('');
		}
		if (!('doctype' in curr_need)) {
			tslogger.warn(`SNV Explorer -> Option doctype not exists in Need ${curr_need}`);
			return vscode.Uri.file('');
		}

		// Calculate doc path uri for current need
		let curr_need_file_path = '';
		if (this.snvConfigs.srcDir) {
			curr_need_file_path = path.resolve(this.snvConfigs.srcDir, curr_need.docname + curr_need.doctype);
			if (!this.pathExists(curr_need_file_path)) {
				tslogger.warn(`SNV Explorer -> doc path for Need ${need.id} not exists: ${curr_need_file_path}`);
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
					tslogger.warn(`SNV Explorer -> Need object entry of ${need.id} not exits in given needs.json`);
				} else {
					// Calculate needed hoverOptionsValues for hover over item
					const hoverOptionValues: string[] = [];
					this.snvConfigs.explorerItemHoverOptions?.forEach((op) => {
						if (!(op in need)) {
							tslogger.warn(`SNV Explorer: given need option ${op} not exists.`);
						} else {
							for (const [key, value] of Object.entries(need)) {
								if (op === key && value && value.length) {
									hoverOptionValues.push(op + ': ' + value);
								}
							}
						}
					});
					// Get need ID Definition Location
					const needFileUri = this.getNeedFilePath(need);
					let needIDPos;
					try {
						needIDPos = findDefinition(need, needFileUri);
					} catch (err) {
						tslogger.error(`SNV Explorer -> No Need ID defintion found for ${need['id']}.`);
					}
					if (!needIDPos) {
						needIDPos = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));
					}
					const needIDLoc = new vscode.Location(needFileUri, needIDPos);

					const needItem = new NeedTree(
						need['id'],
						need['title'],
						need['description'],
						hoverOptionValues,
						needIDLoc,
						vscode.TreeItemCollapsibleState.Collapsed
					);
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
		private content: string,
		private hoverOptions: string[],
		public readonly idLoc: vscode.Location,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState
	) {
		super(id, collapsibleState);
		let hoverContents = `**${this.title}**\n\n\`\`\`\n${this.content}\n\`\`\`\n\n`;
		if (this.hoverOptions) {
			this.hoverOptions.forEach((op) => {
				hoverContents = hoverContents.concat(
					`&nbsp;<span style="color:#ffffff;background-color:#0078d4;">&nbsp;&nbsp;${op}&nbsp;&nbsp;</span>&nbsp;`
				);
			});
		}
		this.tooltip = new vscode.MarkdownString(hoverContents, true);
		this.tooltip.supportHtml = true;
		this.description = this.title;
	}

	contextValue = 'needID';
}

class NeedOptionItem extends vscode.TreeItem {
	constructor(private option: string, collapsibleState: vscode.TreeItemCollapsibleState) {
		super(option, collapsibleState);
		this.tooltip = new vscode.MarkdownString(`${this.option}`, true);
	}
}

function findDefinition(need: Need, fileUri: vscode.Uri): vscode.Range | undefined {
	// Return definition location of given Need ID

	// Read the document where Need ID is at
	const doc_contents = read_need_doc_contents(fileUri);
	if (!doc_contents) {
		return;
	}

	// Get location of need directive definition line index, e.g. .. req::
	const need_directive_location = find_directive_definition(doc_contents, need);
	if (!need_directive_location) {
		return;
	}

	const startIdxID = doc_contents[need_directive_location + 1].indexOf(need['id']);
	const endIdxID = startIdxID + need['id'].length;
	const startPos = new vscode.Position(need_directive_location + 1, startIdxID);
	const endPos = new vscode.Position(need_directive_location + 1, endIdxID);

	return new vscode.Range(startPos, endPos);
}

function read_need_doc_contents(fileUri: vscode.Uri): string[] | null {
	try {
		const doc_content: string = fs.readFileSync(fileUri.fsPath, 'utf8');
		const doc_content_lines = doc_content.split('\n');
		return doc_content_lines;
	} catch (err) {
		tslogger.error(`Error read docoment: ${err}`);
	}
	return null;
}

function find_directive_definition(doc_content_lines: string[], curr_need: Need): number | null {
	// Get line of need id definition with pattern {:id: need_id}
	const id_pattern = `:id: ${curr_need.id}`;
	// Check if id_pattern exists in target document
	if (
		doc_content_lines.every((line) => {
			line.indexOf(id_pattern) !== -1;
		})
	) {
		tslogger.error(`No defintion found of ${curr_need.id}.`);
		return null;
	}
	const found_id_line_idx = doc_content_lines.findIndex((line) => line.indexOf(id_pattern) !== -1);

	// Get line of directive with pattern {.. {need_type}::}
	const directive_pattern = `.. ${curr_need.type}::`;
	// Get lines before id_line_idx to find the line of directive
	const new_doc_content_lines = doc_content_lines.slice(0, found_id_line_idx);
	// Check if direcrive_pattern exists in target document
	if (
		new_doc_content_lines.every((line) => {
			line.indexOf(directive_pattern) !== -1;
		})
	) {
		tslogger.error(`No defintion found of ${curr_need.id}.`);
		return null;
	}
	const found_reverse_directive_line_idx = new_doc_content_lines
		.reverse()
		.findIndex((line) => line.indexOf(directive_pattern) !== -1);
	const found_directive_line_idx = new_doc_content_lines.length - 1 - found_reverse_directive_line_idx;
	return found_directive_line_idx;
}
