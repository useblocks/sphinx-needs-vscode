import * as assert from 'assert';
import * as path from 'path';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as myExtension from '../extension';

suite('Sphinx-Needs Extension Tests', function () {
	this.timeout(30000);

	test('Sample test', () => {
		assert.strictEqual([1, 2, 3].indexOf(5), -1);
		assert.strictEqual([1, 2, 3].indexOf(0), -1);
	});

	// Test completion
	test('Test Completion', async () => {
		const doc_path = path.resolve(__dirname, '../../testData', 'index.rst');
		const docUri = vscode.Uri.file(doc_path);
		const position = new vscode.Position(10, 2);

		// activate extension
		// const doc = await vscode.workspace.openTextDocument(docUri);
		// const ext = vscode.extensions.getExtension('useblocks.sphinx-needs-vscode')!;
		// await ext.activate();
		myExtension.activate;

		const doc = await vscode.workspace.openTextDocument(docUri);
		const editor: vscode.TextEditor = await vscode.window.showTextDocument(doc);
		await sleep(8000);
		// await activate(docUri);

		// Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
		const actualCompletionList = (await vscode.commands.executeCommand(
			'vscode.executeCompletionItemProvider',
			docUri,
			position
		)) as vscode.CompletionList;

		assert.ok(actualCompletionList.items.length === 2);

		// const expectedCompletionList = {
		// 	items: []
		// }
		// expectedCompletionList.items.forEach((expectedItem, i) => {
		// 	const actualItem = actualCompletionList.items[i];
		// 	assert.equal(actualItem.label, expectedItem.label);
		// 	assert.equal(actualItem.kind, expectedItem.kind);
		// });
	});
});

// async function activate(docUri: vscode.Uri) {
// 	// The extensionId is `publisher.name` from package.json
// 	const ext = vscode.extensions.getExtension('useblocks.sphinx-needs-vscode')!;
// 	await ext.activate();
// 	try {
// 		const doc: vscode.TextDocument = await vscode.workspace.openTextDocument(docUri);
// 		const editor: vscode.TextEditor = await vscode.window.showTextDocument(doc);
// 		await sleep(2000); // Wait for server activation
// 	} catch (e) {
// 		console.error(e);
// 	}
// }

async function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
