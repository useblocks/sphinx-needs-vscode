'use strict';

import fs = require('fs');

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

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

let workspace_folder_uri: DocumentUri;

let needs_info: NeedsTypesDocsInfo | undefined;
let doc_src_dir: string;
let needs_json_path: string;

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
}

connection.onInitialize((params: InitializeParams) => {
	if (params.workspaceFolders) {
		workspace_folder_uri = params.workspaceFolders[0].uri;
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
			connection.console.log('Workspace folder change event received.');
		});
	}

	// Get workspace configuration settings of needsJson and srcDir
	await get_wk_conf_settings();

	// Extract needs info from given needs json path
	if (needs_json_path === '') {
		needs_info = undefined;
	} else {
		needs_info = load_needs_info_from_json(needs_json_path);
	}
});

// Get and update workspace settings
async function get_wk_conf_settings() {
	// Get configuration settings
	const conf_settings = await connection.workspace.getConfiguration('sphinx-needs');
	const conf_settings_loader = (result: any) => {
		const cal_wk_folder_uri: string = workspace_folder_uri.replace('file://', '');
		const conf_needs_json_path = result.needsJson.replace('${workspaceFolder}', cal_wk_folder_uri);
		const src_dir = result.srcDir.replace('${workspaceFolder}', cal_wk_folder_uri);
		return [conf_needs_json_path, src_dir];
	};

	// Get setting of needsJson: needs json path
	needs_json_path = conf_settings_loader(conf_settings)[0];
	// Check if given needs json path empty
	if (needs_json_path === '') {
		connection.window.showWarningMessage('Extension Sphinx-Needs: needs json path not configured.');
	}

	// Get setting of srcDir: current docs source directory for sphinx-needs project
	doc_src_dir = conf_settings_loader(conf_settings)[1];
	if (doc_src_dir === '') {
		connection.window.showWarningMessage('Extension Sphinx-Needs: srcDir not configured.');
	}
}

connection.onDidChangeConfiguration(async () => {
	connection.console.log('Configuration changed.');
	// Update workspace configuration settings
	await get_wk_conf_settings();

	if (needs_json_path === '') {
		needs_info = undefined;
	} else {
		needs_info = load_needs_info_from_json(needs_json_path);
	}

	connection.console.log('Worksapce settings updated.');
});

connection.onDidChangeWatchedFiles((_change) => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');

	// Check if needs json file is among the changed files
	let needs_json_file_changes: FileEvent | undefined;
	const changed_files = _change.changes;
	changed_files.forEach((changed_file) => {
		const changed_file_uri = changed_file.uri.replace('file://', '');
		if (changed_file_uri === needs_json_path) {
			needs_json_file_changes = changed_file;
		}
	});

	// Needs Json file changed
	if (needs_json_file_changes) {
		// Check file change type
		if (needs_json_file_changes.type === 1) {
			// Usecase: configuration of NeedsJson file not in sync with needs json file name, user changed file name to sync
			connection.console.log('NeedsJson file created.');
			// Update needs_info by reloading json file again
			needs_info = load_needs_info_from_json(needs_json_path);
		} else if (needs_json_file_changes.type === 3) {
			connection.console.log('NeedsJson file got deleted or renmaed.');
			connection.window.showWarningMessage(
				'Oops! NeedsJson file got deleted or renmaed. Please sync with configuration of sphinx-needs.needsJson.'
			);
		} else if (needs_json_file_changes.type === 2) {
			// NeedsJson File content got updated
			connection.console.log('NeedsJson file content update detected.');

			// Update needs_info by reloading json file again
			needs_info = load_needs_info_from_json(needs_json_path);
		}
	}
});

function read_needs_json(given_needs_json_path: string) {
	// Check if given needs.json path exists
	const needs_json_path = given_needs_json_path;

	if (!fs.existsSync(needs_json_path)) {
		connection.console.log(`Given needs.json not found: ${needs_json_path}`);
		connection.window.showWarningMessage(
			`Given needsJson path: ${needs_json_path} not exists. No language features avaiable.`
		);
		return;
	}

	try {
		const data = fs.readFileSync(needs_json_path, 'utf8');
		const needs_json: NeedsJsonObj = JSON.parse(data);
		return needs_json;
	} catch (err) {
		connection.console.log(`Error reading NeedsJson: ${err}`);
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
		connection.console.warn(
			'Needs current_version is empty in needsJson! Specify version in conf.py would be nice!'
		);
	}
	// Check if versions are empty
	if (!needs_json.versions) {
		connection.console.error('Empty needs in needsJson!');
		return undefined;
	} else {
		if (!(curr_version in needs_json.versions)) {
			connection.console.error('Current version not found in versions from needsJson! Can not load needs!');
			return undefined;
		}
	}

	const needs: Needs = needs_json.versions[curr_version].needs;

	// Check needs not empty
	if (Object.keys(needs).length === 0) {
		connection.console.log('No needs found in given needsJson file.');
		return undefined;
	}

	// Initialize needs_types_docs_info
	const needs_types_docs_info: NeedsTypesDocsInfo = {
		needs: needs,
		needs_types: [],
		docs_per_type: {},
		needs_per_doc: {}
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

	// Breaks line content into words by space or comma
	const words = text.split(/[ ,]+/);

	// Get current word based on current cursor character position, e.g. ['random', 'text', 'some', 'where']
	let index = 0;
	let length = 0;
	const curr_char_pos = params.position.character;
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
	// TODO: need to adapt later, dummy here for now
	const need_id_part = 'NeedID';
	const hash = crypto.createHash('sha256').update(need_id_part).digest('hex').toString();
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
	if (!needs_info) {
		connection.console.log('No needs info extracted from needs json. No completion feature.');
		return [];
	}
	connection.console.log('Completion feature...');

	const context_word = get_word(_textDocumentPosition);

	// if word starts with '->' or ':need:->', provide completion suggestion path from need type to need ID, e.g. need_type > doc_name > need_id
	if (context_word.startsWith('->') || context_word.startsWith(':need:`->')) {
		return complete_path_to_need_id(_textDocumentPosition, context_word, needs_info);
	}

	// if word starts with '..', provide completion suggestion for directive snippets
	if (context_word.startsWith('..')) {
		// Return a list of suggestion of directive of different types
		const directive_items: CompletionItem[] = [];
		needs_info.needs_types.forEach((need_type) => {
			const text = [` ${need_type}:: Dummy Title`, '\t:id: NeedID', '\t:status: open\n', '\tContent.'].join('\n');
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
				insertText: `id: ${generate_random_need_id()}`,
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

// Hover feature for Sphinx-Needs
connection.onHover((_textDocumentPosition: TextDocumentPositionParams): Hover | null => {
	if (!needs_info) {
		connection.console.log('No needs info extracted from needs json. No Hover feature.');
		return null;
	}

	connection.console.log('Hover feature...');

	// Get need_id from hover context
	const need_id = get_word(_textDocumentPosition);

	// Check if need_id exists
	if (!need_id || !(need_id in needs_info.needs)) {
		return null;
	}

	const title = needs_info.needs[need_id].title;
	const description = needs_info.needs[need_id].description;

	return {
		contents: {
			kind: MarkupKind.Markdown,
			value: [`**${title}**`, '', '', '```', `${description}`, '```'].join('\n')
		}
	};
});

function found_docs_srcdir(): boolean {
	if (!doc_src_dir) {
		connection.console.log('srcDir setting not configured.');
		return false;
	} else if (!fs.existsSync(doc_src_dir)) {
		// Check if given srcDir exists
		connection.console.log(`srcDir path not exists: ${doc_src_dir}`);
		connection.window.showWarningMessage(`srcDir path not exists: ${doc_src_dir}`);
		return false;
	} else {
		return true;
	}
}

// Goto definition for Sphinx-Needs
connection.onDefinition((_textDocumentPosition: TextDocumentPositionParams): Definition | null => {
	// Return location of definition of a need
	if (!needs_info) {
		connection.console.log('No needs info extracted from needs json. No Goto Definition feature.');
		return null;
	}

	// Check if srcDir configured and exists
	if (found_docs_srcdir()) {
		connection.console.log('Goto Definition...');
	} else {
		connection.console.log('srcDir not configured or path not exists. No Goto Definition');
		return null;
	}

	// Check current context is actually a need
	const need_id = get_word(_textDocumentPosition);
	if (!need_id || !(need_id in needs_info.needs)) {
		return null;
	}

	// Get the doc path of the need
	const curr_need: Need = needs_info.needs[need_id];
	const doc_path = get_doc_path(curr_need);
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

	return {
		uri: doc_path,
		range: {
			start: { line: need_directive_location, character: 0 },
			end: { line: need_directive_location, character: 0 }
		}
	};
});

// Find references for Sphinx-Needs
connection.onReferences((_textDocumentPosition: TextDocumentPositionParams): Location[] | null => {
	if (!needs_info) {
		connection.console.log('No needs info extracted from needs json. No Find references feature.');
		return null;
	}

	// Check if srcDir configured and exists
	if (found_docs_srcdir()) {
		connection.console.log('Find References...');
	} else {
		connection.console.log('srcDir not configured or path not exists. No Find References');
		return null;
	}

	// Check current context is actually a need
	const need_id = get_word(_textDocumentPosition);
	if (!need_id || !(need_id in needs_info.needs)) {
		return null;
	}

	// Get the doc path of the need
	const curr_need: Need = needs_info.needs[need_id];

	const locations: Location[] = [];
	if (curr_need.bkLinks) {
		curr_need.bkLinks.forEach((link_id) => {
			if (needs_info) {
				const link_need: Need = needs_info.needs[link_id];
				const doc_path = get_doc_path(link_need);
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
				// // Find starting index of need ID
				// const startPosID = doc_contents[need_directive_location + 1].indexOf(link_id);
				// const endPosID = startPosID + link_id.length

				// Find options link ID line index
				const link_id_pattern = new RegExp(':(.)+: ' + '(\\w+, )*' + `${need_id}` + '(, \\w+)*', 'g');
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

				// Get Location of linked need ID inside this directive definition
				const location: Location = {
					uri: doc_path,
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
	// Get line of need id definition with pattern {:id: need_id}
	const id_pattern = `:id: ${curr_need.id}`;
	// Check if id_pattern exists in target document
	if (
		doc_content_lines.every((line) => {
			line.indexOf(id_pattern) !== -1;
		})
	) {
		connection.console.log(`No defintion found of ${curr_need.id}.`);
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
		connection.console.log(`No defintion found of ${curr_need.id}.`);
		return null;
	}
	const found_reverse_directive_line_idx = new_doc_content_lines
		.reverse()
		.findIndex((line) => line.indexOf(directive_pattern) !== -1);
	const found_directive_line_idx = new_doc_content_lines.length - 1 - found_reverse_directive_line_idx;
	return found_directive_line_idx;
}

function get_doc_path(curr_need: Need): string {
	let conf_py_path: string;
	if (doc_src_dir.endsWith('/')) {
		conf_py_path = doc_src_dir;
	} else {
		conf_py_path = doc_src_dir + '/';
	}
	const doc_path = conf_py_path + curr_need.docname + curr_need.doctype;
	return doc_path;
}

function read_doc_content(doc_path: string): string[] | null {
	try {
		const doc_content: string = fs.readFileSync(doc_path, 'utf8');
		const doc_content_lines = doc_content.split('\n');
		return doc_content_lines;
	} catch (err) {
		connection.console.log(`Error read docoment: ${err}`);
	}
	return null;
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
