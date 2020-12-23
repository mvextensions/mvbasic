/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from 'path';

import { runTests } from 'vscode-test';

async function main() {
	try {
		// The folder containing the Extension Manifest package.json
		// Passed to `--extensionDevelopmentPath`
		const extensionDevelopmentPath = path.resolve(__dirname, '../../../');

		// The path to test runner
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(__dirname, './index');

		// Download VS Code, unzip it and run the integration test
		await runTests({ 
			extensionDevelopmentPath, 
			extensionTestsPath, 
			/**
			 * A list of launch arguments passed to VS Code executable, in addition to `--extensionDevelopmentPath`
			 * and `--extensionTestsPath` which are provided by `extensionDevelopmentPath` and `extensionTestsPath`
			 * options.
			 *
			 * If the first argument is a path to a file/folder/workspace, the launched VS Code instance
			 * will open it.
			 *
			 * See `code --help` for possible arguments.
			 */
  			launchArgs: ['--disable-extensions'] });
	} catch (err) {
		console.error('Failed to run tests');
		process.exit(1);
	}
}

main();