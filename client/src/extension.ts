'use strict';

import * as path from 'path';
import { workspace, ExtensionContext, languages } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TextDocumentFilter,
	TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
	console.log('Activated Sphinx-Needs-VsCode Extension.');

	// The server is implemented in node
	const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// Get supported files for this extension when activated from configuration settings
	let supported_files: string[] | undefined = workspace.getConfiguration('sphinx-needs').get('activateFiles');

	const document_filters: TextDocumentFilter[] = [];
	if (supported_files) {
		// Filter duplicate items
		supported_files = supported_files.filter((item, index, arr) => {
			return arr.indexOf(item) === index;
		});
		// Get document filters for language client options
		supported_files.forEach((element) => {
			// Check if user input settings of activateFiles are supported by VsCode
			languages.getLanguages().then((value) => {
				if (value.indexOf(element) !== -1) {
					document_filters.push({
						scheme: 'file',
						language: element
					});
				} else {
					console.warn(`Given language settings of activatedFiles not supported by VsCode: ${element}`);
				}
			});
		});
	}

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		documentSelector: document_filters,
		synchronize: {
			// Notify the server about file changes to .json files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/*.json')
		}
	};

	// Create the language client and start the client.
	client = new LanguageClient('sphinxNeeds', 'Sphinx-Needs', serverOptions, clientOptions);

	// Start the client. This will also launch the server
	client.start();
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
