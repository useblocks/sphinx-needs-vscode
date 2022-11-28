import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
	// The folder containing the Extension Manifest package.json
	// Passed to `--extensionDevelopmentPath`
	const extensionDevelopmentPath = path.resolve(__dirname, '../../../');

	// The path to test runner
	// Passed to --extensionTestsPath
	const extensionTestsPath = path.resolve(__dirname, './index');

	// test worksapce
	const testWorkspace = path.resolve(__dirname, '../../testData/');

	let failed = false;

	try {
		// Download VS Code, unzip it and run the integration test
		await runTests({
			extensionDevelopmentPath,
			extensionTestsPath,
			// launchArgs: [
			//     '--disable-extensions', // disable all other extensions
			//     '--force-disable-user-env'
			// ]
			launchArgs: [testWorkspace]
		});
	} catch (err) {
		console.error('Faild to run tests' + err);
		failed = true;
	}

	if (failed) {
		process.exit(1);
	}
}

main();
