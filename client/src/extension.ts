import * as path from 'path';
import { workspace, window, ExtensionContext } from 'vscode';

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  // The server is implemented in node
  let serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  let serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions
    }
  };

  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
    // Register the server for rst documents
    documentSelector: [{ scheme: 'file', language: 'restructuredtext' }],
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
    }
  };

  // Get configuration of needs.json
  // console.log(`workspace name: ${workspace.name}`);

  // let needs_json_path: string = workspace.getConfiguration('sphinx-needs').get('needsJson');
  // const currentWorkspaceFolderPath = workspace.getWorkspaceFolder(window.activeTextEditor.document.uri)?.uri.fsPath
  // needs_json_path = needs_json_path.replace('${workspaceFolder}', currentWorkspaceFolderPath)

  // console.log(`needs json path: ${needs_json_path}`)
  // // Read json file
	// const fs = require('fs');
  // const data = fs.readFileSync(needs_json_path, 'utf8');
  // const needs_json = JSON.parse(data);
  // console.log(`needs json.project: ${needs_json.project}`);


  // Create the language client and start the client.
  client = new LanguageClient(
    'sphinxNeeds',
    'Sphinx-Needs',
    serverOptions,
    clientOptions
  );

  // Start the client. This will also launch the server
  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}