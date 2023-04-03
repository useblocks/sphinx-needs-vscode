import * as assert from 'assert';
import * as path from 'path';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../extension';

suite('Sphinx-Needs Extension Tests for rst file', function () {
	this.timeout(30000);

	test('Sample test', () => {
		assert.strictEqual([1, 2, 3].indexOf(5), -1);
		assert.strictEqual([1, 2, 3].indexOf(0), -1);
	});

	// Test Document
	const doc_path = path.resolve(__dirname, '../../testData/doc1', 'index.rst');
	const docUri = vscode.Uri.file(doc_path);

	// Test completion
	test('Test Completion', async () => {
		// Activate extension
		await activate(docUri);

		const expectedSnippets: vscode.CompletionList = {
			items: [
				{
					label: '.. req::',
					kind: vscode.CompletionItemKind.Snippet,
					insertText: ' req:: Dummy Title\n\t:id: NeedID\n\t:status: open\n\n\tContent.'
				},
				{
					label: '.. spec::',
					kind: vscode.CompletionItemKind.Snippet,
					insertText: ' spec:: Dummy Title\n\t:id: NeedID\n\t:status: open\n\n\tContent.'
				}
			]
		};

		const expectedNeedRoleOrOption: vscode.CompletionList = {
			items: [
				{ label: ':id:', detail: 'needs option', kind: vscode.CompletionItemKind.Snippet },
				{ label: ':need:', detail: 'need role', kind: vscode.CompletionItemKind.Snippet }
			]
		};

		// ->
		const expectedNeedPathLev1: vscode.CompletionList = {
			items: [
				{ label: 'req', detail: 'need type' },
				{ label: 'spec', detail: 'need type' }
			]
		};

		// ->req>
		const expectedNeedPathLev2: vscode.CompletionList = {
			items: [
				{ label: 'index.rst', detail: 'path to needs doc', kind: vscode.CompletionItemKind.File },
				{ label: 'mySubFolder', detail: 'path to needs doc', kind: vscode.CompletionItemKind.Folder }
			]
		};

		// ->req>index.rst>
		const expectedNeedPathLev3: vscode.CompletionList = {
			items: [
				{ label: 'REQ_1', insertText: 'REQ_1', detail: 'First requirement of doc1', documentation: 'Requirement content of REQ_1.' }
			]
		};

		// ->req>mySubFolder/
		const expectedPathFolderInsider: vscode.CompletionList = {
			items: [
				{ label: 'sub.rst', detail: 'needs doc', kind: vscode.CompletionItemKind.File, insertText: 'sub.rst' }
			]
		};

		const testCases: [string, vscode.Position, vscode.CompletionList][] = [
			['trigger ..', new vscode.Position(10, 2), expectedSnippets],
			['trigger :', new vscode.Position(34, 1), expectedNeedRoleOrOption],
			['trigger > at lev1', new vscode.Position(38, 9), expectedNeedPathLev1],
			['trigger > at lev2', new vscode.Position(40, 13), expectedNeedPathLev2],
			['trigger > at lev3', new vscode.Position(42, 23), expectedNeedPathLev3],
			['trigger /', new vscode.Position(44, 25), expectedPathFolderInsider]
		];

		const promises = testCases.map(async ([name, position, expectedItems]) => {
			// Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
			const actualCompletionList = (await vscode.commands.executeCommand(
				'vscode.executeCompletionItemProvider',
				docUri,
				position
			)) as vscode.CompletionList;

			// test trigger ..
			if (name === 'trigger ..') {
				assert.ok(actualCompletionList.items.length === 2, `Completion over ${name} failed.`);
				expectedItems.items.forEach((expectedItem, i) => {
					const actualItem = actualCompletionList.items[i];
					assert.equal(actualItem.label, expectedItem.label);
					assert.equal(actualItem.kind, expectedItem.kind);
					assert.equal(
						(<vscode.SnippetString>actualItem.insertText).value,
						<vscode.SnippetString>expectedItem.insertText
					);
				});
			} else if (name === 'trigger :') {
				assert.ok(actualCompletionList.items.length === 2, `Completion over ${name} failed.`);
				expectedItems.items.forEach((expectedItem, i) => {
					const actualItem = actualCompletionList.items[i];
					assert.equal(actualItem.label, expectedItem.label);
					assert.equal(actualItem.kind, expectedItem.kind);
					assert.equal(actualItem.detail, expectedItem.detail);
				});
			} else if (name === 'trigger > at lev1') {
				assert.ok(actualCompletionList.items.length === 2, `Completion over ${name} failed.`);
				expectedItems.items.forEach((expectedItem, i) => {
					const actualItem = actualCompletionList.items[i];
					assert.equal(actualItem.label, expectedItem.label);
					assert.equal(actualItem.detail, expectedItem.detail);
				});
			} else if (name === 'trigger > at lev2') {
				assert.ok(actualCompletionList.items.length === 2, `Completion over ${name} failed.`);
				expectedItems.items.forEach((expectedItem, i) => {
					const actualItem = actualCompletionList.items[i];
					assert.equal(actualItem.label, expectedItem.label);
					assert.equal(actualItem.detail, expectedItem.detail);
					assert.equal(actualItem.kind, expectedItem.kind);
				});
			} else if (name === 'trigger > at lev3') {
				assert.ok(actualCompletionList.items.length === 1, `Completion over ${name} failed.`);
				const actualItem = actualCompletionList.items[0];
				const expectedItem = expectedItems.items[0];
				assert.equal(actualItem.label, expectedItem.label);
				assert.equal(actualItem.detail, expectedItem.detail);
				assert.equal(actualItem.insertText, expectedItem.insertText);
				assert.equal(actualItem.documentation, expectedItem.documentation);
			} else if (name === 'trigger /') {
				assert.ok(actualCompletionList.items.length === 1, `Completion over ${name} failed.`);
				const actualItem = actualCompletionList.items[0];
				const expectedItem = expectedItems.items[0];
				assert.equal(actualItem.label, expectedItem.label);
				assert.equal(actualItem.detail, expectedItem.detail);
				assert.equal(actualItem.kind, expectedItem.kind);
				assert.equal(actualItem.insertText, expectedItem.insertText);
			}
		});
		return Promise.all(promises);
	});

	// Test Hover
	test('Test Hover', async () => {
		// Activate extension
		await activate(docUri);

		// Create test cases with expected results
		const testCases: [string, vscode.Position, string][] = [
			['inside needID', new vscode.Position(11, 10), 'Requirement content of REQ_1.'],
			['inside non needID', new vscode.Position(6, 3), '']
		];

		const promises = testCases.map(async ([name, position, expectedMsg]) => {
			const hovers = (await vscode.commands.executeCommand(
				'vscode.executeHoverProvider',
				docUri,
				position
			)) as vscode.Hover[];

			const hover = hovers[0];
			if (expectedMsg) {
				assert.equal(hover.contents.length, 1);
				const displayText = (<vscode.MarkdownString>hover.contents[0]).value;
				assert.ok(displayText.includes(expectedMsg), `Hover over ${name} failed.`);
			} else {
				// negative tests
				assert.equal(hover, null);
			}
		});
		return Promise.all(promises);
	});

	// Test Goto Definition
	test('Test Goto Definition', async () => {
		// Activate extension
		await activate(docUri);

		const testCases: [string, vscode.Position, string, vscode.Position][] = [
			['goto same file', new vscode.Position(21, 12), docUri.path, new vscode.Position(20, 0)],
			[
				'goto different file',
				new vscode.Position(36, 1),
				path.resolve(__dirname, '../../testData/doc1/mySubFolder', 'sub.rst'),
				new vscode.Position(3, 0)
			],
			['goto multiple ID same line', new vscode.Position(36, 10), docUri.path, new vscode.Position(20, 0)],
			[
				'goto option with multiple ID first',
				new vscode.Position(13, 15),
				docUri.path,
				new vscode.Position(20, 0)
			],
			[
				'goto option with multiple ID last',
				new vscode.Position(14, 19),
				path.resolve(__dirname, '../../testData/doc1/mySubFolder', 'sub.rst'),
				new vscode.Position(3, 0)
			],
			[
				'goto option with multiple ID first',
				new vscode.Position(14, 11),
				path.resolve(__dirname, '../../testData/doc1/mySubFolder', 'sub.rst'),
				new vscode.Position(9, 0)
			],
			['negative goto', new vscode.Position(6, 3), '', new vscode.Position(0, 0)],
			[
				'goto definition for nested child need',
				new vscode.Position(36, 18),
				path.resolve(__dirname, '../../testData/doc1/mySubFolder', 'sub.rst'),
				new vscode.Position(23, 0)
			],
			[
				'goto definition for nested grand child need',
				new vscode.Position(36, 26),
				path.resolve(__dirname, '../../testData/doc1/mySubFolder', 'sub.rst'),
				new vscode.Position(41, 0)
			],
		];

		const promises = testCases.map(async ([name, position, expectedDoc, expectedPos]) => {
			const definitions = (await vscode.commands.executeCommand(
				'vscode.executeDefinitionProvider',
				docUri,
				position
			)) as vscode.Location[];

			const definition = definitions[0];
			if (expectedDoc) {
				assert.ok(expectedDoc, `Goto Definition over ${name} failed.`);
				assert.equal(definition.uri.path, expectedDoc);
				assert.equal(definition.range.start.line, expectedPos.line);
				assert.equal(definition.range.start.character, expectedPos.character);
				assert.equal(definition.range.end.line, expectedPos.line);
				assert.equal(definition.range.end.character, expectedPos.character);
			} else {
				assert.equal(definition, null);
			}
		});
		return Promise.all(promises);
	});

	// Test Find References
	test('Test Find References', async () => {
		// Activate extension
		await activate(docUri);

		// Get sub sfolder file URI
		const subFolderFileUri = vscode.Uri.file(path.resolve(__dirname, '../../testData/doc1/mySubFolder', 'sub.rst'));

		const testCases: [string, vscode.Position, vscode.Location[]][] = [
			[
				'find references multiple',
				new vscode.Position(23, 14),
				[
					new vscode.Location(
						docUri,
						new vscode.Range(new vscode.Position(14, 9), new vscode.Position(14, 14))
					),
					new vscode.Location(
						docUri,
						new vscode.Range(new vscode.Position(23, 11), new vscode.Position(23, 16))
					),
					new vscode.Location(
						subFolderFileUri,
						new vscode.Range(new vscode.Position(19, 18), new vscode.Position(19, 23))
					),
					new vscode.Location(
						vscode.Uri.file(path.resolve(__dirname, '../../testData/doc1', 'test.txt')),
						new vscode.Range(new vscode.Position(16, 11), new vscode.Position(16, 16))
					),
				]
			],
			[
				'find references single',
				new vscode.Position(21, 10),
				[
					new vscode.Location(
						docUri,
						new vscode.Range(new vscode.Position(13, 11), new vscode.Position(13, 17))
					)
				]
			]
		];

		const promises = testCases.map(async ([name, position, expectedLocations]) => {
			const allReferences = (await vscode.commands.executeCommand(
				'vscode.executeReferenceProvider',
				docUri,
				position
			)) as vscode.Location[];

			if (name === 'find references multiple') {
				assert.ok(allReferences.length === 4, `Find References over ${name} failed.`);
			}

			if (name === 'find references single') {
				assert.ok(allReferences.length === 1, `Find References over ${name} failed.`);
			}

			expectedLocations.forEach((expLoc, i) => {
				const actualRef = allReferences[i];
				assert.equal(actualRef.uri.path, expLoc.uri.path);
				assert.equal(actualRef.range.start.line, expLoc.range.start.line);
				assert.equal(actualRef.range.start.character, expLoc.range.start.character);
				assert.equal(actualRef.range.end.line, expLoc.range.end.line);
				assert.equal(actualRef.range.end.character, expLoc.range.end.character);
			});
		});
		return Promise.all(promises);
	});
});

suite('Sphinx-Needs Extension Tests for plaintext file', function () {
	this.timeout(30000);

	// Test Document
	const doc_path = path.resolve(__dirname, '../../testData/doc1', 'test.txt');
	const docUri = vscode.Uri.file(doc_path);

	// Test hover
	test('Test hover', async () => {
		// Activate extension
		await activate(docUri);

		// Create test cases with expected results
		const testCases: [string, vscode.Position, string][] = [
			['inside needID', new vscode.Position(3, 2), 'Requirement content of REQ_3.'],
			['inside non needID', new vscode.Position(11, 3), '']
		];

		const promises = testCases.map(async ([name, position, expectedMsg]) => {
			const hovers = (await vscode.commands.executeCommand(
				'vscode.executeHoverProvider',
				docUri,
				position
			)) as vscode.Hover[];

			const hover = hovers[0];
			if (expectedMsg) {
				assert.equal(hover.contents.length, 1);
				const displayText = (<vscode.MarkdownString>hover.contents[0]).value;
				assert.ok(displayText.includes(expectedMsg), `Hover over ${name} failed.`);
			} else {
				// negative tests
				assert.equal(hover, null);
			}
		});
		return Promise.all(promises);
	});
});

suite('Sphinx-Needs Extension Tests for multi docs', function () {
	this.timeout(30000);

	// Test folder doc2
	const doc2_path = path.resolve(__dirname, '../../testData/doc2', 'index.rst');
	const doc2_uri = vscode.Uri.file(doc2_path);

	// Test folder doc3
	const doc3_path = path.resolve(__dirname, '../../testData/doc3', 'index.rst');
	const doc3_uri = vscode.Uri.file(doc3_path);

	// Test Hover
	test('Test Hover', async () => {
		// Activate extension
		await activate(doc2_uri);
		const testCasesDoc2: [string, vscode.Position, string][] = [
			['inside needID', new vscode.Position(16, 11), 'Requirement content of REQ_2.'],
			['inside non needID', new vscode.Position(3, 2), '']
		];
		const promises_doc2 = testCasesDoc2.map(async ([name, position, expectedMsg]) => {
			const hovers = (await vscode.commands.executeCommand(
				'vscode.executeHoverProvider',
				doc2_uri,
				position
			)) as vscode.Hover[];

			const hover = hovers[0];
			if (expectedMsg) {
				assert.equal(hover.contents.length, 1);
				const displayText = (<vscode.MarkdownString>hover.contents[0]).value;
				assert.ok(displayText.includes(expectedMsg), `Hover over ${name} failed.`);
			} else {
				// negative tests
				assert.equal(hover, null);
			}
		});

		// Activate extension
		await activate(doc3_uri);
		const testCasesDoc3: [string, vscode.Position, string][] = [
			['inside needID', new vscode.Position(29, 11), 'Content of SPEC_3.'],
			['inside non needID', new vscode.Position(3, 2), '']
		];
		const promises_doc3 = testCasesDoc3.map(async ([name, position, expectedMsg]) => {
			const hovers = (await vscode.commands.executeCommand(
				'vscode.executeHoverProvider',
				doc3_uri,
				position
			)) as vscode.Hover[];

			const hover = hovers[0];
			if (expectedMsg) {
				assert.equal(hover.contents.length, 1);
				const displayText = (<vscode.MarkdownString>hover.contents[0]).value;
				assert.ok(displayText.includes(expectedMsg), `Hover over ${name} failed.`);
			} else {
				// negative tests
				assert.equal(hover, null);
			}
		});

		return Promise.all([promises_doc2, promises_doc3]);

	});
});

async function activate(docUri: vscode.Uri) {
	// Activate extension
	// TODO: Seems that extension activate useless, why still works now
	// const ext = vscode.extensions.getExtension('useblocks.sphinx-needs-vscode')!;
	// await ext.activate();

	const doc = await vscode.workspace.openTextDocument(docUri);
	// Wait for server
	await sleep(3000);
}

async function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
