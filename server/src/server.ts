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
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
} from 'vscode-languageserver/node';

import {
	DocumentUri,
	TextDocument
} from 'vscode-languageserver-textdocument';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

let workspace_folder_name: string;
let workspace_folder_uri: DocumentUri;

connection.onInitialize((params: InitializeParams) => {
	workspace_folder_name = params.workspaceFolders[0].name;
	workspace_folder_uri = params.workspaceFolders[0].uri;
	connection.console.log(`workspace folder name: ${workspace_folder_name}`);
	connection.console.log(`workspace folder uri: ${workspace_folder_uri}`);

	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

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
		}
	};

	connection.console.log(`HasWorkspaceFolderCapabilitiy: ${hasWorkspaceFolderCapability}`);
	connection.console.log(`HasConfigurationCapability: ${hasConfigurationCapability}`);
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

connection.onDidChangeConfiguration(change => {

	// TODO: check if needs.json path changed or content updated
	connection.console.log(`wk folder: ${workspace_folder_uri}`);
	const conf_needs = connection.workspace.getConfiguration('sphinx-needs'); // it's a promise pending, how to get the value
	connection.console.log(`conf needs json: ${conf_needs}`);

});

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

// Define type of Need, Needs, NeedsJsonObject, and NeedsTypesDocsInfo
interface NeedsJsonObj {
	created: string;
	current_version: string;
	project: string;
	versions: {
		[version_num: number]: {
			created: string;
			filters: {};
			needs: {
				[need_id: string]: Need;
			};
		}
	}
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
}

interface NeedsTypesDocsInfo {
	needs: Needs,
	needs_types: string[];
	docs_per_type: {
		[type: string]: string[];
	};
	needs_per_doc: {
		[doc: string]: Need[];
	};
}

function read_needs_json(given_needs_json_path) {
	// Read json file
	const fs = require('fs');

	// Check if given needs.json path exists
	// const needs_json_path = '/home/haiyang/work/useblocks/github/sphinx-needs-ide/server/src/needs_small.json'
	const needs_json_path = given_needs_json_path;

	try {
		const data = fs.readFileSync(needs_json_path, 'utf8');
		const needs_json: NeedsJsonObj = JSON.parse(data);
		return needs_json;
	} catch (err) {
		connection.console.log(err);
	}

	// if (fs.existsSync(needs_json_path)) {
	// 	const data = fs.readFileSync(needs_json_path, 'utf8');
	// 	const needs_json: NeedsJsonObj = JSON.parse(data);
	// } else {
	// 	connection.console.log('No needs.json found!');
	// }
	return;
}

function load_needs_info_from_json(given_needs_json_path: string): NeedsTypesDocsInfo {
	// Read and parse given needs.json file
	const needs_json = read_needs_json(given_needs_json_path);

	// Load needs from latest version
	const needs_latest_version = Object.keys(needs_json.versions).sort().at(-1);
	const needs: Needs = needs_json.versions[needs_latest_version].needs;

	// Initialize needs_types_docs_info
	let needs_types_docs_info: NeedsTypesDocsInfo = {
		needs: needs,
		needs_types: [],
		docs_per_type: {},
		needs_per_doc: {},
	};

	// Get need types, docs_per_type, and needs_per_doc
	Object.values(needs).forEach(need => {
		if (!(need['type'] in needs_types_docs_info.docs_per_type)) {
			needs_types_docs_info.needs_types.push(need['type'])
			needs_types_docs_info.docs_per_type[need['type']] = []
		}
		const need_doc_name = need.docname + need.doctype;
		if (!(needs_types_docs_info.docs_per_type[need['type']].includes(need_doc_name))) {
			needs_types_docs_info.docs_per_type[need['type']].push(need_doc_name)
		}

		if (!(need_doc_name in needs_types_docs_info.needs_per_doc)) {
			needs_types_docs_info.needs_per_doc[need_doc_name] = []
		}
		needs_types_docs_info.needs_per_doc[need_doc_name].push(need)
	});

	return needs_types_docs_info;

}

// // Load needs from latest version
// const needs_json = read_needs_json()
// const needs_latest_version = Object.keys(needs_json.versions).sort().at(-1);
// const needs: Needs = needs_json.versions[needs_latest_version].needs;

// // Get need types, docs_per_type, and needs_per_doc
// const needs_types = [];
// const docs_per_type = {};
// const needs_per_doc = {};
// Object.values(needs).forEach(need => {
// 	if (!(need['type'] in docs_per_type)) {
// 		needs_types.push(need['type'])
// 		docs_per_type[need['type']] = []
// 	}
// 	const need_doc_name = need.docname + need.doctype;
// 	if (!(docs_per_type[need['type']].includes(need_doc_name))) {
// 		docs_per_type[need['type']].push(need_doc_name)
// 	}

// 	if (!(need_doc_name in needs_per_doc)) {
// 		needs_per_doc[need_doc_name] = []
// 	}
// 	needs_per_doc[need_doc_name].push(need)
// });

//#################################################//

// Get the word in a line of text at a given character positioon
function get_word(params: TextDocumentPositionParams): string {
	// Get current document line content
	const document = documents.get(params.textDocument.uri)
	const curr_line = {
		start: {line: params.position.line, character: 0},
		end: {line: params.position.line + 1, character: 0}
	}
	const text = document.getText(curr_line).replace(/[\n\r]/g, '');

	// Breaks line content into words by space
	const words = text.split(' ')

	// Get current word based on current cursor character position, e.g. ['random', 'text', 'some', 'where']
	let index = 0;
	let length = 0;
	const curr_char_pos = params.position.character;
	for (const word of words) {
		length = length + word.length
		if (curr_char_pos <= index + length) {
			return words[index]
		}
		index = index + 1
	}
	return words[index - 1]
}

// Generate hash value from given string
function generate_hash() {
	const crypto = require('crypto');
	const need_id_part = 'NeedID';  // TODO: need to adapt later, dummy here for now
	const hash = crypto.createHash('sha256').update(need_id_part).digest('hex').toString();
	return hash;
}

connection.console.log(`Test hash value: ${generate_hash()}`);

function generate_random_need_id(): string {
	const random_id = generate_hash().slice(0, 8);  // for now, length of 8
	return random_id;
}

// Completion suggestion for documentation location of given need type
function complete_doc_path(docs: string[], doc_pattern: string): CompletionItem[] {
	// Get all doc paths that start with given pattern
	doc_pattern = doc_pattern.replace('`', '');  // in case :need:`->req>`

	const found_paths: string[] = [];
	docs.forEach(doc => {
		if (doc.startsWith(doc_pattern)) {
			found_paths.push(doc);
		}
	});

	// Check the amount of found doc paths
	if (found_paths.length == 0) {
		return;
	}

	// Found only one doc
	if (found_paths.length == 1) {
		const insert_text = found_paths[0].slice(doc_pattern.length);
		return [
			{
				label: insert_text,
				detail: 'needs doc',
				insertText: insert_text,
				kind: CompletionItemKind.File,
			}
		]
	}

	// At least two paths found, need to check if path contains folder and subfolder
	const cnt_path_sep: number[] = [];
	found_paths.forEach(path => {
		cnt_path_sep.push((path.match(/[/]/g) || []).length);
	});
	const max_path_length: number = Math.max(...cnt_path_sep);
	const curr_path_length: number = (doc_pattern.match(/[/]/g) || []).length;

	if (max_path_length == 0 && curr_path_length == 0) {
		const sub_path_items: CompletionItem[] = [];
		found_paths.forEach(path => {
			sub_path_items.push(
				{
					label: path,
					detail: 'path to need doc',
					kind: CompletionItemKind.File,
				}
			);
		});
		return sub_path_items;
	}

	const sub_paths: string[] = [];
	found_paths.forEach(path => {
		if ((path.match(/[/]/g) || []).length >= curr_path_length) {
			const new_sub_path = path.split('/').slice(curr_path_length, curr_path_length + 1).join('/');
			if (!sub_paths.includes(new_sub_path)) {
				sub_paths.push(new_sub_path);
			}
		}
	});
	sub_paths.sort();

	const sub_folder_file_items: CompletionItem[] = [];
	sub_paths.forEach(path => {
		let kind;
		if (path.indexOf('.rst') > -1) {
			kind = CompletionItemKind.File;
		} else {
			kind = CompletionItemKind.Folder;
		}
		sub_folder_file_items.push(
			{
				label: path,
				detail: 'path to needs doc',
				kind: kind,
			}
		);
	});

	return sub_folder_file_items;
}

// Completion suggestion for need ID based on need type and location documentation
function complete_path_to_need_id(textDocPos: TextDocumentPositionParams, context_word: string, needs_info: NeedsTypesDocsInfo): CompletionItem[] {

	// Count '>' for suggestion level from need type to need ID
	const suggest_level: number = (context_word.match(/>/g) || []).length;

	// Suggest need type, e.g. ->req
	if (suggest_level == 1) {
		const types_items: CompletionItem[] = [];
		needs_info.needs_types.forEach(need_type => {
			types_items.push(
				{
					label: need_type,
					detail: 'need type',
				}
			);
		});
		return types_items;
	}

	// Split context word by '>'
	const word_parts = context_word.split('>');

	// Suggest document name for chosen need type, e.g. ->req>fusion/index.rst
	const requested_type = word_parts[1];
	if (suggest_level == 2) {
		// Check if requested type exists
		if (needs_info.needs_types.includes(requested_type)) {
			return complete_doc_path(needs_info.docs_per_type[requested_type], word_parts[2]);
		}
	}

	// Suggest need ID for chosen document. e.g. ->req>fusion/index.rst>REQ_1
	if (suggest_level == 3) {
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
			needs_info.needs_per_doc[requested_doc].forEach(need => {
				if (need.type == requested_type) {
					need_id_items.push(
						{
							label: need.id,
							insertText: need.id,
							documentation: need.description,
							detail: need.title,
							additionalTextEdits: [
								{
									range: {
										start: { line: textDocPos.position.line, character: replace_start_char },
										end: { line: textDocPos.position.line, character: textDocPos.position.character },
									},
									newText: '',
								}
							],
						}
					);
				}
			});
		}
		return need_id_items;
	}

	return;
}

// Completion feature for Sphinx-Needs
connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		// The pass parameter contains the position of the text document in
		// which code complete got requested.
		connection.console.log('Completion feature...');
		connection.console.log(`${workspace_folder_uri}`);

		// Read and load given needs.json
		const given_needs_json_path: string = workspace_folder_uri.replace('file://', '') + '/' + 'needs_small.json';
		const needs_info = load_needs_info_from_json(given_needs_json_path);


		const context_word = get_word(_textDocumentPosition);
		
		// if word starts with '->' or ':need:->', provide completion suggestion path from need type to need ID, e.g. need_type > doc_name > need_id
		if (context_word.startsWith('->') || context_word.startsWith(':need:`->')) {
			return complete_path_to_need_id(_textDocumentPosition, context_word, needs_info);
		}

		// if word starts with '..', provide completion suggestion for directive snippets
		if (context_word.startsWith('..')) {
			// Return a list of suggestion of directive of different types
			const directive_items: CompletionItem[] = [];
			needs_info.needs_types.forEach(need_type => {
				const text = [
					` ${need_type}:: Dummy Title`,
					'\t:id: NeedID',
					'\t:status: open\n',
					'\tContent.'
				].join('\n');
				directive_items.push(
					{
						label: `.. ${need_type}::`,
						insertText: `${text}`,
						insertTextFormat: InsertTextFormat.Snippet,
						kind: CompletionItemKind.Snippet,
					}
				);
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

		return;
	}
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		return item;
	}
);

// Hover feature for Sphinx-Needs
connection.onHover(
	(_textDocumentPosition: TextDocumentPositionParams): Hover => {

		// Read and load given needs.json
		const given_needs_json_path: string = workspace_folder_uri.replace('file://', '') + '/' + 'needs_small.json';
		const needs_info = load_needs_info_from_json(given_needs_json_path);

		// Get need_id from hover context
		const need_id = get_word(_textDocumentPosition)

		// Check if need_id exists
		if (!need_id || !(need_id in needs_info.needs)) {
			return;
		}

		const title = needs_info.needs[need_id].title;
		const description = needs_info.needs[need_id].description;

		return {
			contents: {
				kind: MarkupKind.Markdown,
				value: [
					`**${title}**`,
					'',
					'',
				 	'```',
					`${description}`,
					'```'
				].join('\n')
			}
		};
	}
);

// Goto definition for Sphinx-Needs
connection.onDefinition(
	(_textDocumentPosition: TextDocumentPositionParams): Definition => {
		// Return location of definition of a need

		// Read and load given needs.json
		const given_needs_json_path: string = workspace_folder_uri.replace('file://', '') + '/' + 'needs_small.json';
		const needs_info = load_needs_info_from_json(given_needs_json_path);

		// Check current context is actually a need
		const need_id = get_word(_textDocumentPosition)
		if (!need_id || !(need_id in needs_info.needs)) {
			return;
		}

		// Get the doc path of the need
		const curr_need: Need = needs_info.needs[need_id]
		const conf_py_path = workspace_folder_uri.replace('file://', '') + '/'
		const doc_path = conf_py_path + curr_need.docname + curr_need.doctype

		const fs = require('fs');
		try {
			const doc_content: string = fs.readFileSync(doc_path, 'utf8');
			const doc_content_lines = doc_content.split('\n');

			// Get line of need id definition with pattern {:id: need_id}
			const id_pattern = `:id: ${need_id}`;
			// Check if id_pattern exists in goto document
			if (doc_content_lines.every((line) => {line.indexOf(id_pattern) != -1})) {
				connection.console.log(`No defintion found of ${need_id}.`);
				return;
			}
			const found_id_line_idx = doc_content_lines.findIndex(line => line.indexOf(id_pattern) != -1);

			// Get line of directive with pattern {.. {need_type}::}
			const directive_pattern = `.. ${curr_need.type}::`;
			// Get lines before id_line_idx to find the line of directive
			const new_doc_content_lines = doc_content_lines.slice(0, found_id_line_idx)
			// Check if direcrive_pattern exists in goto document
			if (new_doc_content_lines.every((line) => {line.indexOf(directive_pattern) != -1})) {
				connection.console.log(`No defintion found of ${need_id}.`);
				return;
			}
			const found_directive_line_idx = new_doc_content_lines.findIndex(line => line.indexOf(directive_pattern) != -1);
			return {
				uri: doc_path,
				range: {
					start: { line: found_directive_line_idx, character: 0 },
					end: { line: found_directive_line_idx, character: 0 }
				}
			};

		}  catch (err) {
			connection.console.log(err);
		}

		return;
	}
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
