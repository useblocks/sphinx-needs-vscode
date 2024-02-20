'use strict';

import fs = require('fs');
import url = require('url');


import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	InsertTextFormat,
	Hover,
	MarkupKind,
	Definition,
	Location,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	FileEvent
} from 'vscode-languageserver/node';

import { DocumentUri, TextDocument } from 'vscode-languageserver-textdocument';

import { LogLevel, TimeStampedLogger } from './logging';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

let workspace_folder_uri: DocumentUri;

let needs_infos: NeedsInfos;
let isMultiDocs = false;
let multiToNone = false;
let wsConfigs: WsConfigs;

let tslogger: TimeStampedLogger;

// Define type of Need, Needs, NeedsJsonObject, and NeedsTypesDocsInfo
interface NeedsJsonObj {
	created: string;
	current_version: string;
	project: string;
	versions: {
		[version_num: string]: {
			created: string;
			filters: {};
			needs: {
				[need_id: string]: Need;
			};
		};
	};
}

interface Needs {
	[need_id: string]: Need;
}

interface Need {
	description: string;
	docname: string;
	doctype: string;
	title: string;
	id: string;
	type: string;
	links: string[];
	bkLinks: string[];
	parent_need: string;
}

interface NeedsTypesDocsInfo {
	needs: Needs;
	needs_types: string[];
	docs_per_type: {
		[type: string]: string[];
	};
	needs_per_doc: {
		[doc: string]: Need[];
	};
	src_dir: string;
	all_files_abs_paths: string[];
}

interface NeedsInfos {
	[path: string]: NeedsTypesDocsInfo | undefined;
}

interface DocConf {
	needsJson: string;
	srcDir: string;
}

interface WsConfigs {
	needsJson: string;
	srcDir: string;
	folders: DocConf[];
	loggingLevel: LogLevel;
}

connection.onInitialize((params: InitializeParams) => {
	if (params.workspaceFolders) {
		workspace_folder_uri = url.fileURLToPath(decodeURIComponent(params.workspaceFolders[0].uri)); //extract the path from uri.
	} else {
		workspace_folder_uri = '';
	}

	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
	hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server supports code completion.
			completionProvider: {
				triggerCharacters: [':', '.', '/', '>'],
				resolveProvider: true
			},
			// Supports hover
			hoverProvider: true,
			// Supports goto definition
			definitionProvider: true,
			// Supports find references
			referencesProvider: true
		}
	};

	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(async () => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(() => {
			connection.console.info('Workspace folder change event received.');
		});
	}

	// Get relevant workspace configuration settings
	wsConfigs = await get_wk_conf_settings();

	// Initial logger
	tslogger = new TimeStampedLogger(wsConfigs.loggingLevel);

	// Check and load all needsJson from workspace configurations
	needs_infos = load_all_needs_json(wsConfigs);
});

// Load all needsJson
function load_all_needs_json(configs: WsConfigs) {
	// Check workspace configurations
	check_wk_confs(configs);

	const all_needs_infos: NeedsInfos = {};
	// load sphinx-needs.folders
	configs.folders.forEach((fd) => {
		if (!(fd.needsJson in all_needs_infos)) {
			all_needs_infos[fd.needsJson] = load_needs_info_from_json(fd.needsJson);
		} else {
			connection.window.showWarningMessage('SNV: Duplicate needsJson config in sphinx-needs.folders');
		}
	});
	// load sphinx-needs.needsJson
	if (configs.needsJson && configs.srcDir && !(configs.needsJson in all_needs_infos)) {
		all_needs_infos[configs.needsJson] = load_needs_info_from_json(configs.needsJson);
	}
	return all_needs_infos;
}

// Check workspace configuration settings
function check_wk_confs(configs: WsConfigs) {
	if (configs) {
		// Check if sphinx-needs.needsJson empty and exists
		if (configs.needsJson === '') {
			connection.window.showWarningMessage('SNV: sphinx-needs.needsJson path not configured.');
		} else if (!fs.existsSync(configs.needsJson)) {
			tslogger.error(`SNV: Given sphinx-needs.needsJson path not exists: ${configs.needsJson}`);
			connection.window.showWarningMessage(
				`SNV: Given sphinx-needs.needsJson path: ${configs.needsJson} not exists.`
			);
		}
		// Check if sphinx-needs.srcDir empty and exists
		if (configs.srcDir === '') {
			connection.window.showWarningMessage('SNV: sphinx-needs.srcDir not configured.');
		} else if (!fs.existsSync(configs.srcDir)) {
			tslogger.error(`SNV: Given sphinx-needs.srcDir path not exists: ${configs.srcDir}`);
			connection.window.showWarningMessage(`SNV: Given sphinx-needs.srcDir path: ${configs.srcDir} not exists.`);
		}
		// Check if needsJson and srcDir in sphinx-needs.folders empty and exist
		if (configs.folders.length <= 0) {
			tslogger.debug('SNV: sphinx-needs.folders empty');
			isMultiDocs = false;
		} else {
			configs.folders.forEach((folder) => {
				if (folder.needsJson === '') {
					connection.window.showWarningMessage('SNV: needsJson path in sphinx-needs.folders is empty.');
				} else if (!fs.existsSync(folder.needsJson)) {
					tslogger.error(`SNV: Given sphinx-needs.folders needsJson path not exists: ${folder.needsJson}`);
					connection.window.showWarningMessage(
						`SNV: Given sphinx-needs.folders needsJson path: ${folder.needsJson} not exists.`
					);
				}
				if (folder.srcDir === '') {
					connection.window.showWarningMessage('SNV: srcDir path in sphinx-needs.folders is empty.');
				} else if (!fs.existsSync(folder.srcDir)) {
					tslogger.error(`SNV: Given sphinx-needs.folders srcDir path not exists: ${folder.srcDir}`);
					connection.window.showWarningMessage(
						`SNV: Given sphinx-needs.folders srcDir path: ${folder.srcDir} not exists.`
					);
				}
			});
			isMultiDocs = true;
		}
	}
}

// Get workspace settings
async function get_wk_conf_settings() {
	const cal_wk_folder_uri: string = workspace_folder_uri //workspace is normalized already
	//const cal_wk_folder_uri: string = workspace_folder_uri.replace('file://', '');

	// Get configuration of sphinx-needs.needsJson
	let needs_json_path = '';
	await connection.workspace.getConfiguration('sphinx-needs.needsJson').then((value) => {
		needs_json_path = value.replace('${workspaceFolder}', cal_wk_folder_uri);
	});

	// Get configuration of sphinx-needs.srcDir
	let doc_src_dir = '';
	await connection.workspace.getConfiguration('sphinx-needs.srcDir').then((value) => {
		doc_src_dir = value.replace('${workspaceFolder}', cal_wk_folder_uri);
	});

	// Get configuration of sphinx-needs.loggingLevel
	let confLogLevel: LogLevel = 'warn';
	await connection.workspace.getConfiguration('sphinx-needs.loggingLevel').then((value) => {
		confLogLevel = value;
	});

	// Get configuration of sphinx-needs.folders
	const wk_folders: DocConf[] = [];
	await connection.workspace.getConfiguration('sphinx-needs.folders').then((value) => {
		value.forEach((conf: DocConf) => {
			wk_folders.push({
				needsJson: conf.needsJson.replace('${workspaceFolder}', cal_wk_folder_uri),
				srcDir: conf.srcDir.replace('${workspaceFolder}', cal_wk_folder_uri)
			});
		});
	});

	const configs: WsConfigs = {
		needsJson: needs_json_path,
		srcDir: doc_src_dir,
		folders: wk_folders,
		loggingLevel: confLogLevel
	};
	return configs;
}

connection.onDidChangeConfiguration(async () => {
	// Update workspace configuration settings
	const newConfigs = await get_wk_conf_settings();

	// Check if sphinx-needs.loggingLevel changed
	if (newConfigs.loggingLevel !== wsConfigs.loggingLevel) {
		// Update loggingLevel and logger
		wsConfigs.loggingLevel = newConfigs.loggingLevel;
		tslogger = new TimeStampedLogger(wsConfigs.loggingLevel);
	}

	let reloadNeedsJson = false;
	// Check if sphinx-needs.needsJson changed
	if (newConfigs.needsJson !== wsConfigs.needsJson) {
		// Update wsConfigs.needsJson
		wsConfigs.needsJson = newConfigs.needsJson;
		reloadNeedsJson = true;
	}

	// Check if sphinx-needs.srcDir changed
	if (newConfigs.srcDir !== wsConfigs.srcDir) {
		wsConfigs.srcDir = newConfigs.srcDir;
		reloadNeedsJson = true;
	}

	// Check if sphinx-needs.folders changed
	if (newConfigs.folders !== wsConfigs.folders) {
		wsConfigs.folders = newConfigs.folders;
		if (wsConfigs.folders.length <= 0) {
			multiToNone = true;
		}
		reloadNeedsJson = true;
	}

	if (reloadNeedsJson) {
		needs_infos = load_all_needs_json(wsConfigs);
	}

	tslogger.info('SNV: Configuration changed.');
});

connection.onDidChangeWatchedFiles((_change) => {
	// Monitored files have change in VSCode
	// Check if needs json file is among the changed files
	let needs_json_file_changes: FileEvent | undefined;
	const changed_files = _change.changes;
	changed_files.forEach((changed_file) => {
		const changed_file_uri : string = url.fileURLToPath(decodeURIComponent(changed_file.uri));
		//const changed_file_uri = changed_file.uri.replace('file://', '');
		if (Object.keys(needs_infos).indexOf(changed_file_uri) >= 0) {
			needs_json_file_changes = changed_file;
		}
	});

	// Needs Json file changed
	if (needs_json_file_changes) {
		const changed_needs_json : string = url.fileURLToPath(needs_json_file_changes.uri);
		//const changed_needs_json = needs_json_file_changes.uri.replace('file://', '');
		// Check file change type
		if (needs_json_file_changes.type === 1) {
			// Usecase: configuration of NeedsJson file not in sync with needs json file name, user changed file name to sync
			tslogger.info('SNV: NeedsJson file created.');
			// Update needs_info by reloading json file again
			needs_infos[changed_needs_json] = load_needs_info_from_json(changed_needs_json);
		} else if (needs_json_file_changes.type === 3) {
			tslogger.warn('SNV: NeedsJson file got deleted or renmaed.');
			connection.window.showWarningMessage('SNV: NeedsJson file got deleted or renmaed.');
		} else if (needs_json_file_changes.type === 2) {
			// NeedsJson File content got updated
			tslogger.info('SNV: NeedsJson file content update detected.');
			// Update needs_info by reloading json file again
			needs_infos[changed_needs_json] = load_needs_info_from_json(changed_needs_json);
		}
	}
});

function read_needs_json(given_needs_json_path: string) {
	// Check if given needs.json path exists
	const needs_json_path = given_needs_json_path;

	if (!fs.existsSync(needs_json_path)) {
		return;
	}

	try {
		const data = fs.readFileSync(needs_json_path, 'utf8');
		const needs_json: NeedsJsonObj = JSON.parse(data);
		return needs_json;
	} catch (err) {
		tslogger.error(`SNV: Error reading NeedsJson: ${err}`);
	}

	return;
}

function load_needs_info_from_json(given_needs_json_path: string): NeedsTypesDocsInfo | undefined {
	// Read and parse given needs.json file
	const needs_json = read_needs_json(given_needs_json_path);

	if (!needs_json) {
		return undefined;
	}

	// Load needs from current version
	const curr_version: string = needs_json.current_version;
	if (!curr_version) {
		tslogger.warn('SNV: Needs current_version is empty in needsJson! Specify version in conf.py would be nice!');
	}
	// Check if versions are empty
	if (!needs_json.versions) {
		tslogger.error('SNV: Empty needs in needsJson!');
		return undefined;
	} else {
		if (!(curr_version in needs_json.versions)) {
			tslogger.error('SNV: Current version not found in versions from needsJson! Can not load needs!');
			return undefined;
		}
	}

	const needs: Needs = needs_json.versions[curr_version].needs;

	// Check needs not empty
	if (Object.keys(needs).length === 0) {
		tslogger.warn('SNV: No needs found in given needsJson file.');
		return undefined;
	}

	// Check and calculate doctype for nested needs
	for (const need of Object.values(needs)) {
		let temp_parent_id: string;
		let temp_parent: Need;
		// Get child need
		if (!need['doctype'] && need['parent_need']) {
			// search up to top parent need to get info of doctype
			temp_parent_id = need['parent_need'];
			temp_parent = needs[temp_parent_id];
			while (temp_parent['parent_need']) {
				if (!temp_parent['parent_need']) {
					break;
				}
				temp_parent = needs[temp_parent['parent_need']];
			}
			need['doctype'] = temp_parent['doctype'];
		}
	}

	// Get current srcDir
	let curr_src_dir = '';
	if (wsConfigs.needsJson === given_needs_json_path) {
		curr_src_dir = wsConfigs.srcDir;
	} else {
		wsConfigs.folders.forEach((conf) => {
			if (conf.needsJson === given_needs_json_path) {
				curr_src_dir = conf.srcDir;
			}
		});
	}
	if (!curr_src_dir.endsWith('/')) {
		curr_src_dir = curr_src_dir + '/';
	}

	// Initialize needs_types_docs_info
	const needs_types_docs_info: NeedsTypesDocsInfo = {
		needs: needs,
		needs_types: [],
		docs_per_type: {},
		needs_per_doc: {},
		src_dir: curr_src_dir,
		all_files_abs_paths: []
	};

	// Get need types, docs_per_type, and needs_per_doc
	Object.values(needs).forEach((need) => {
		// initial new entry bkLinks for each need object
		need.bkLinks = [];

		if (!(need['type'] in needs_types_docs_info.docs_per_type)) {
			needs_types_docs_info.needs_types.push(need['type']);
			needs_types_docs_info.docs_per_type[need['type']] = [];
		}
		const need_doc_name = need.docname + need.doctype;
		if (!needs_types_docs_info.docs_per_type[need['type']].includes(need_doc_name)) {
			needs_types_docs_info.docs_per_type[need['type']].push(need_doc_name);
		}

		if (!(need_doc_name in needs_types_docs_info.needs_per_doc)) {
			needs_types_docs_info.needs_per_doc[need_doc_name] = [];
		}
		needs_types_docs_info.needs_per_doc[need_doc_name].push(need);
	});

	// Calculate back links for each need object
	for (const [need_id, value] of Object.entries(needs)) {
		// Get back links for needs_extra_links
		for (const [need_option, op_value] of Object.entries(value)) {
			if (need_option.endsWith('_back') && op_value && Array.isArray(op_value)) {
				op_value.forEach((id: string) => {
					// Validates linked need ID and check if already exists in bkLinks
					if (Object.keys(needs).indexOf(id) !== -1 && value.bkLinks.indexOf(id) === -1) {
						value.bkLinks.push(id);
					}
				});
			}
		}
		// Get and calculate back links for normal need links option
		if (value.links) {
			value.links.forEach((bk_need) => {
				if (bk_need in needs && needs[bk_need].bkLinks.indexOf(need_id) === -1) {
					needs[bk_need].bkLinks.push(need_id);
				}
			});
		}
	}

	// Calulcate all files full paths in current srcDir
	const path = require('path'); //to get the proper file separator character
	Object.keys(needs_types_docs_info.needs_per_doc).forEach((fp) => {
		needs_types_docs_info.all_files_abs_paths.push(path.normalize(curr_src_dir + fp)); //use the normalized path
	});

	return needs_types_docs_info;
}

// Get the word in a line of text at a given character positioon
function get_word(params: TextDocumentPositionParams): string {
	// Get current document line content
	const document = documents.get(params.textDocument.uri);
	const curr_line = {
		start: { line: params.position.line, character: 0 },
		end: { line: params.position.line + 1, character: 0 }
	};
	if (!document) {
		return '';
	}
	const text = document.getText(curr_line).replace(/[\n\r]/g, '');
	// Check if text starts with empty psace, e.g. text = '      REQ_3, REQ_2'
	// Trim start empty space in text
	const newText = text.trimStart();
	let curr_char_pos = params.position.character;
	if (newText.length < text.length) {
		curr_char_pos = curr_char_pos - text.length + newText.length;
	}

	// Breaks line content into words by space or comma, and filter out empty string
	const words = text.split(/[ ,]+/).filter((word) => word.length > 0);

	// Get current word based on current cursor character position, e.g. ['random', 'text', 'some', 'where']
	let index = 0;
	let length = 0;
	for (const word of words) {
		length = length + word.length;
		if (curr_char_pos <= index + length) {
			return words[index];
		}
		index = index + 1;
	}
	return words[index - 1];
}

// Generate hash value from given string
function generate_hash() {
	const crypto = require('crypto');
	const salt = crypto.randomBytes(256).toString('hex');
	const hash = crypto.createHash('sha256').update(salt).digest('hex').toString();
	return hash;
}

function generate_random_need_id(): string {
	// TODO: for now, length of 8, adapt later
	const random_id = generate_hash().slice(0, 8);
	return random_id;
}

// Completion suggestion for documentation location of given need type
function complete_doc_path(docs: string[], doc_pattern: string): CompletionItem[] {
	// Get all doc paths that start with given pattern
	// in case :need:`->req>`
	doc_pattern = doc_pattern.replace('`', '');

	const found_paths: string[] = [];
	docs.forEach((doc) => {
		if (doc.startsWith(doc_pattern)) {
			found_paths.push(doc);
		}
	});

	// Check the amount of found doc paths
	if (found_paths.length === 0) {
		return [];
	}

	// Found only one doc
	if (found_paths.length === 1) {
		const insert_text = found_paths[0].slice(doc_pattern.length);
		return [
			{
				label: insert_text,
				detail: 'needs doc',
				insertText: insert_text,
				kind: CompletionItemKind.File
			}
		];
	}

	// At least two paths found, need to check if path contains folder and subfolder
	const cnt_path_sep: number[] = [];
	found_paths.forEach((path) => {
		cnt_path_sep.push((path.match(/[/]/g) || []).length);
	});
	const max_path_length: number = Math.max(...cnt_path_sep);
	const curr_path_length: number = (doc_pattern.match(/[/]/g) || []).length;

	if (max_path_length === 0 && curr_path_length === 0) {
		const sub_path_items: CompletionItem[] = [];
		found_paths.forEach((path) => {
			sub_path_items.push({
				label: path,
				detail: 'path to need doc',
				kind: CompletionItemKind.File
			});
		});
		return sub_path_items;
	}

	const sub_paths: string[] = [];
	found_paths.forEach((path) => {
		if ((path.match(/[/]/g) || []).length >= curr_path_length) {
			const new_sub_path = path
				.split('/')
				.slice(curr_path_length, curr_path_length + 1)
				.join('/');

			if (!sub_paths.includes(new_sub_path)) {
				sub_paths.push(new_sub_path);
			}
		}
	});
	sub_paths.sort();

	const sub_folder_file_items: CompletionItem[] = [];
	sub_paths.forEach((path) => {
		let kind;
		if (path.indexOf('.rst') > -1) {
			kind = CompletionItemKind.File;
		} else {
			kind = CompletionItemKind.Folder;
		}
		sub_folder_file_items.push({
			label: path,
			detail: 'path to needs doc',
			kind: kind
		});
	});

	return sub_folder_file_items;
}

// Completion suggestion for need ID based on need type and location documentation
function complete_path_to_need_id(
	textDocPos: TextDocumentPositionParams,
	context_word: string,
	needs_info: NeedsTypesDocsInfo
): CompletionItem[] {
	// Count '>' for suggestion level from need type to need ID
	const suggest_level: number = (context_word.match(/>/g) || []).length;

	// Suggest need type, e.g. ->req
	if (suggest_level === 1) {
		const types_items: CompletionItem[] = [];
		needs_info.needs_types.forEach((need_type) => {
			types_items.push({
				label: need_type,
				detail: 'need type'
			});
		});
		return types_items;
	}

	// Split context word by '>'
	const word_parts = context_word.split('>');

	// Suggest document name for chosen need type, e.g. ->req>fusion/index.rst
	const requested_type = word_parts[1];
	if (suggest_level === 2) {
		// Check if requested type exists
		if (needs_info.needs_types.includes(requested_type)) {
			return complete_doc_path(needs_info.docs_per_type[requested_type], word_parts[2]);
		}
	}

	// Suggest need ID for chosen document. e.g. ->req>fusion/index.rst>REQ_1
	if (suggest_level === 3) {
		const need_id_items: CompletionItem[] = [];
		const requested_doc: string = word_parts[2];
		if (requested_doc in needs_info.needs_per_doc) {
			const substitution = context_word.slice(context_word.indexOf('->'));
			// in case :need:`->req>index.rst>REQ_1`
			let replace_start_char: number;
			if (context_word.endsWith('`')) {
				replace_start_char = textDocPos.position.character - substitution.length + 1;
			} else {
				replace_start_char = textDocPos.position.character - substitution.length;
			}
			// const start_char = textDocPos.position.character;
			needs_info.needs_per_doc[requested_doc].forEach((need) => {
				if (need.type === requested_type) {
					need_id_items.push({
						label: need.id,
						insertText: need.id,
						documentation: need.description,
						detail: need.title,
						additionalTextEdits: [
							{
								range: {
									start: { line: textDocPos.position.line, character: replace_start_char },
									end: { line: textDocPos.position.line, character: textDocPos.position.character }
								},
								newText: ''
							}
						]
					});
				}
			});
		}
		return need_id_items;
	}

	return [];
}

// Completion feature for Sphinx-Needs
connection.onCompletion((_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
	// The pass parameter contains the position of the text document in
	// which code complete got requested.

	// Get current needs info
	const curr_needs_info = get_curr_needs_info(_textDocumentPosition);
	if (!curr_needs_info) {
		tslogger.warn('SNV: No needs info extracted from needs json. No completion feature.');
		return [];
	}
	tslogger.debug('SNV: Completion feature...');

	const context_word = get_word(_textDocumentPosition);

	// if word starts with '->' or ':need:->', provide completion suggestion path from need type to need ID, e.g. need_type > doc_name > need_id
	if (context_word.startsWith('->') || context_word.startsWith(':need:`->')) {
		return complete_path_to_need_id(_textDocumentPosition, context_word, curr_needs_info);
	}

	// if word starts with '..', provide completion suggestion for directive snippets
	if (context_word.startsWith('..')) {
		// Return a list of suggestion of directive of different types
		const directive_items: CompletionItem[] = [];
		curr_needs_info.needs_types.forEach((need_type) => {
			const text = [
				` ${need_type}:: Dummy Title`,
				`\t:id: ${need_type.toUpperCase()}_${generate_random_need_id()}`,
				'\t:status: open\n',
				'\tContent.'
			].join('\n');
			directive_items.push({
				label: `.. ${need_type}::`,
				insertText: `${text}`,
				insertTextFormat: InsertTextFormat.Snippet,
				kind: CompletionItemKind.Snippet
			});
		});

		return directive_items;
	}

	// if word starts with ':', provide completion suggestion for role or option
	if (context_word.startsWith(':')) {
		// Find need type from line above if possible, applying only to following usecase,
		//   .. req:: Title
		//      :id:
		// where directive definition ..req:: line is directly above :id: line
		let found_need_type = '';
		const document = documents.get(_textDocumentPosition.textDocument.uri);
		const line_above = {
			start: { line: _textDocumentPosition.position.line - 1, character: 0 },
			end: { line: _textDocumentPosition.position.line, character: 0 }
		};
		if (document) {
			const line_above_text = document.getText(line_above);
			const found = line_above_text.match(/.. [A-Za-z]*::/g);
			if (found) {
				found_need_type = found[0].replace('.. ', '').replace('::', '');
			}
		}

		return [
			{
				label: ':need:',
				detail: 'need role',
				insertText: 'need:`ID`',
				insertTextFormat: InsertTextFormat.Snippet,
				kind: CompletionItemKind.Snippet
			},
			{
				label: ':id:',
				detail: 'needs option',
				insertText: `id: ${found_need_type.toUpperCase()}_${generate_random_need_id()}`,
				insertTextFormat: InsertTextFormat.Snippet,
				kind: CompletionItemKind.Snippet
			}
		];
	}

	return [];
});

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
	return item;
});

function get_curr_needs_info(params: TextDocumentPositionParams): NeedsTypesDocsInfo | undefined {
	if (!multiToNone && !isMultiDocs) {
		return needs_infos[wsConfigs.needsJson];
	} else {
		// Get current document file path
		const curr_doc_uri: string = url.fileURLToPath(decodeURIComponent(params.textDocument.uri));
		//const curr_doc_uri = params.textDocument.uri.replace('file://', '');     

		// Check and determine which needsJson infos to use
		for (const [need_json, need_info] of Object.entries(needs_infos)) {
			if (need_info?.all_files_abs_paths && need_info.all_files_abs_paths.indexOf(curr_doc_uri) >= 0) {
				return needs_infos[need_json];
			}
		}
    		//Enable autocompletion in new rst file. Return the default json file as specified vscode setting. 
    		return needs_infos[wsConfigs.needsJson];        
	}
}

// Hover feature for Sphinx-Needs
connection.onHover((_textDocumentPosition: TextDocumentPositionParams): Hover | null => {
	// Get current needs info
	const curr_needs_info = get_curr_needs_info(_textDocumentPosition);

	// Check if current needs info exists
	if (!curr_needs_info) {
		tslogger.warn('SNV: No needs info extracted from needs json. No Hover feature.');
		return null;
	}

	tslogger.debug('SNV: Hover features...');
	// Get need_id from hover context
	const need_id = get_word(_textDocumentPosition);
	// Check if need_id exists
	if (!need_id || !(need_id in curr_needs_info.needs)) {
		return null;
	}
	const curr_title = curr_needs_info.needs[need_id].title;
	const curr_description = curr_needs_info.needs[need_id].description;
	return {
		contents: {
			kind: MarkupKind.Markdown,
			value: [`**${curr_title}**`, '', '', '```', `${curr_description}`, '```'].join('\n')
		}
	};
});

// Goto definition for Sphinx-Needs
connection.onDefinition((_textDocumentPosition: TextDocumentPositionParams): Definition | null => {
	// Get current needs info
	const curr_needs_info = get_curr_needs_info(_textDocumentPosition);
	// Check if current needs info exists
	if (!curr_needs_info) {
		tslogger.warn('SNV: No needs info extracted from needs json. No Goto Definition feature.');
		return null;
	}

	// Check if srcDir path exists
	if (fs.existsSync(curr_needs_info.src_dir)) {
		tslogger.debug('SNV: Goto Definition...');
	} else {
		tslogger.warn('SNV: srcDir path not exists. No Goto Definition');
		return null;
	}

	// Check current context is actually a need
	const need_id = get_word(_textDocumentPosition);
	if (!need_id || !(need_id in curr_needs_info.needs)) {
		return null;
	}

	// Get the doc path of the need
	const curr_need: Need = curr_needs_info.needs[need_id];
	const doc_path = curr_needs_info.src_dir + curr_need.docname + curr_need.doctype;
	// Read the document contents
	const doc_contents = read_doc_content(doc_path);
	if (!doc_contents) {
		return null;
	}
	// Get need directive definition line index
	const need_directive_location = find_directive_location(doc_contents, curr_need);
	if (!need_directive_location) {
		return null;
	}

    	const url = require('url'); //pass the path as uri

	return {
		uri:  url.pathToFileURL(doc_path), //encoding uri. 
		range: {
			start: { line: need_directive_location, character: 0 },
			end: { line: need_directive_location, character: 0 }
		}
	};
});

// Find references for Sphinx-Needs
connection.onReferences((_textDocumentPosition: TextDocumentPositionParams): Location[] | null => {
	// Get current needs info
	const curr_needs_info = get_curr_needs_info(_textDocumentPosition);
	if (!curr_needs_info) {
		tslogger.warn('SNV: No needs info extracted from needs json. No Find references feature.');
		return null;
	}

	// Check if srcDir path exists
	if (fs.existsSync(curr_needs_info.src_dir)) {
		tslogger.debug('SNV: Find References...');
	} else {
		tslogger.warn('SNV: srcDir path not exists. No Find References');
		return null;
	}

	// Check current context is actually a need
	const need_id = get_word(_textDocumentPosition);
	if (!need_id || !(need_id in curr_needs_info.needs)) {
		return null;
	}

	// Get the doc path of the need
	const curr_need: Need = curr_needs_info.needs[need_id];

	const locations: Location[] = [];
	if (curr_need.bkLinks) {
		curr_need.bkLinks.forEach((link_id) => {
			if (curr_needs_info) {
				const link_need: Need = curr_needs_info.needs[link_id];
				const doc_path = curr_needs_info.src_dir + link_need.docname + link_need.doctype;
				// Read the document contents
				const doc_contents = read_doc_content(doc_path);
				if (!doc_contents) {
					return null;
				}
				// Get need directive definition line index
				const need_directive_location = find_directive_location(doc_contents, link_need);
				if (!need_directive_location) {
					return null;
				}
				// Find options link ID line index
				const link_id_pattern = `${need_id}`;
				const options_lines_contents = doc_contents.slice(need_directive_location);
				// const new_found_link_id_line_idx = options_lines_contents.findIndex((line) => line.indexOf(need_id) !== -1);
				const new_found_link_id_line_idx = options_lines_contents.findIndex((line) =>
					line.match(link_id_pattern)
				);
				if (new_found_link_id_line_idx === -1) {
					connection.console.warn(`${need_id} not found referenced under need direcitve ${link_id}`);
					return null;
				}
				const found_link_id_line_idx = new_found_link_id_line_idx + need_directive_location;
				// Find start and end position of linked ID
				const startPosID = doc_contents[found_link_id_line_idx].indexOf(need_id);
				const endPosID = startPosID + need_id.length;

                		const url = require('url');   
            
				// Get Location of linked need ID inside this directive definition
				const location: Location = {
					uri: url.pathToFileURL(doc_path),//pass the path as uri 
					range: {
						start: { line: found_link_id_line_idx, character: startPosID },
						end: { line: found_link_id_line_idx, character: endPosID }
					}
				};

				if (location) {
					locations.push(location);
				}
			}
		});
	}
	return locations;
});

function find_directive_location(doc_content_lines: string[], curr_need: Need): number | null {
    
    	const path = require('path'); //to get the proper file separator character    
	// Get line of need id definition with pattern {:id: need_id}
	const id_pattern = `:id: ${curr_need.id}`;
	// Check if id_pattern exists in target document
	if (
		doc_content_lines.every((line) => {
			line.indexOf(id_pattern) !== -1;
		})
	) {
		tslogger.warn(`SNV: No defintion found of ${curr_need.id}.`);
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
		tslogger.warn(`SNV: No defintion found of ${curr_need.id}.`);
		return null;
	}
	const found_reverse_directive_line_idx = new_doc_content_lines
		.reverse()
		.findIndex((line) => line.indexOf(directive_pattern) !== -1);
	const found_directive_line_idx = new_doc_content_lines.length - 1 - found_reverse_directive_line_idx;
	return found_directive_line_idx;
}

function read_doc_content(doc_path: string): string[] | null {
    	const path = require('path'); //to get the proper file separator character
    	try {
		const doc_content: string = fs.readFileSync(path.normalize(doc_path), 'utf8');
		const doc_content_lines = doc_content.split('\n');
		return doc_content_lines;
	} catch (err) {
		tslogger.error(`SNV: Error read docoment: ${err}`);
	}
	return null;
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
