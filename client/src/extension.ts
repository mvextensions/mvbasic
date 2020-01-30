/* --------------------------------------------------------------------------------------------
 * Copyright (c) MV Extensions. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import * as path from 'path';
import * as vscode from 'vscode';

import { RestFS } from "./RestFS";
import { RestFSAttr } from "./RestFS";

import { workspace, ExtensionContext } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';
import fs = require('fs')


var RESTFS: RestFS;
var UsingRest: Boolean = false;


export function activate(context: ExtensionContext) {

	// The server is implemented in node
	let serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);
	// The debug options for the server
	let debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
	}

	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for mvon and remote mvon documents
		documentSelector: [{ scheme: 'file', language: 'mvbasic' }, { scheme: 'RestFS', language: 'mvbasic' }],
		synchronize: {
			// Synchronize the setting section 'languageServerExample' to the server
			configurationSection: 'MVBasic',
			// Notify the server about file changes to '.clientrc files contain in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	}

	let RemoteHost: string = vscode.workspace.getConfiguration("MVBasic").get("RemoteHost");
	let UserName: string = vscode.workspace.getConfiguration("MVBasic").get("UserName");
	let Password: string = vscode.workspace.getConfiguration("MVBasic").get("Password");
	let Account: string = vscode.workspace.getConfiguration("MVBasic").get("Account")
	let AccountPath: string = vscode.workspace.getConfiguration("MVBasic").get("AccountPath")
	let AccountPassword: string = vscode.workspace.getConfiguration("MVBasic").get("AccountPassword")
	let GatewayType: string = vscode.workspace.getConfiguration("MVBasic").get("GatewayType");
	let UseGateway: boolean = vscode.workspace.getConfiguration("MVBasic").get("UseGateway");
	UsingRest = vscode.workspace.getConfiguration("MVBasic").get("UseRestFS");
	//let HomePath: string = vscode.workspace.getConfiguration("MVBasic").get("homePath");
	//let codePage: string = vscode.workspace.getConfiguration("MVBasic").get("encoding");
	let margin: number = vscode.workspace.getConfiguration("MVBasic").get("margin");
	let indent: number = vscode.workspace.getConfiguration("MVBasic").get("indent");
	let formattingEnabled: boolean = vscode.workspace.getConfiguration("MVBasic").get("formattingEnabled");
	//let additionalFiles: any = vscode.workspace.getConfiguration("MVBasic").get("additionalFiles"); // deprecated
	//let gatewayDebug: any = vscode.workspace.getConfiguration("MVBasic").get("gatewayDebug");
	let editFiles: any = vscode.workspace.getConfiguration("MVBasic").get("EditFiles");
	let customWordColor: any = vscode.workspace.getConfiguration("MVBasic").get("customWordColor");
	let customWordlist: string = vscode.workspace.getConfiguration("MVBasic").get("customWords");
	let customWordPath: any = vscode.workspace.getConfiguration("MVBasic").get("customWordPath");
	let RestPath: any = vscode.workspace.getConfiguration("MVBasic").get("RestPath");
	let AutoConnect: boolean = vscode.workspace.getConfiguration("MVBasic").get("RestAutoConnect");
	let RestAPIVersion: number = vscode.workspace.getConfiguration("MVBasic").get("RestFS.RestAPI", 0);
	let RestMaxItems: number = vscode.workspace.getConfiguration("MVBasic").get("RestFS.MaxItems", 0);
	let RestDefAttr: number = vscode.workspace.getConfiguration("MVBasic").get("RestFS.DefAttr", 0);
	let RestCaseSensitive: boolean = vscode.workspace.getConfiguration("MVBasic").get("RestFS.CaseSensitive");
	
	// gateway implies RestFS
	UsingRest = UsingRest || UseGateway; 
	
	// default MV dir selection: file (folder), item (file), q-pointers (symlink), ignore items in dictionary level files
	if (RestDefAttr === 0) 
		RestDefAttr = RestFSAttr.ATTR_FOLDER | RestFSAttr.ATTR_FILE | RestFSAttr.ATTR_SYMLINK | RestFSAttr.ATTR_DATAONLY;
	
	let timeout: NodeJS.Timer | null = null;
	var customWordDict = new Map();

	if (customWordPath != "") {
		var contents = fs.readFileSync(customWordPath, 'utf8')
		customWordlist = "(";
		var lines = contents.replace('\r', '').split('\n');
		for (let i = 0; i < lines.length; i++) {
			let parts = lines[i].split(':')
			customWordDict.set(parts[0].replace("\"", "").replace("\"", ""), parts[1].replace("\"", "").replace("\"", ""))
			customWordlist += parts[0].replace('"', '').replace("\"", "") + "|";
		}
		customWordlist = customWordlist.substr(0, customWordlist.length - 1) + ")";

	}


	// Create the language client and start the client.
	let disposable = new LanguageClient('mvbasic', 'MV Basic Server', serverOptions, clientOptions).start();


	// initialise Remote REST FileSystem
	if (UsingRest) {

		RESTFS = new RestFS(RestAPIVersion);
		context.subscriptions.push(vscode.workspace.registerFileSystemProvider('RestFS', RESTFS, { isCaseSensitive: RestCaseSensitive }));		

		let connectRestFS = function(): boolean {
			
			RESTFS.initRestFS(RestPath, Account, {max_items: RestMaxItems, def_attr: RestDefAttr});
			
			// send credentials (some of these are specific to the gateway)
			let login = {
				"ServerIP": RemoteHost,
				"ServerType": GatewayType,
				"UserId": UserName,
				"Password": Password,
				"AccountName": Account,
				"AccountPath": AccountPath,
				"AccountPassword": AccountPassword
			};
			if (!RESTFS.login(login)) {				
				vscode.window.showInformationMessage('Unable to connect to the RestFS server. Please check your settings.');
				return false;
			}
			
			// Display a message box to the user
			vscode.window.showInformationMessage('Connected to RestFS server ' + RestPath);
			// The next line ensures the file explorer will be loaded correctly
			vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');	
			
			// auto-open files
			if (editFiles && (typeof editFiles == 'string' || editFiles instanceof Array)) {
				if (typeof editFiles == 'string')
					editFiles = [editFiles];
				editFiles.forEach(function(item: any) {
					if (typeof item == 'string') {
						vscode.workspace.openTextDocument(vscode.Uri.parse('RestFS://' + item))
						.then(function(doc: vscode.TextDocument) {
							vscode.window.showTextDocument(doc, -2, false)
						});
					}
				});
			}
			editFiles = undefined; // only once

			return true;
		};

		if (AutoConnect) {
			connectRestFS();
		}

		var initialiseRestFS = vscode.commands.registerCommand('extension.initialiseRestFS', async () => {
			// Check we have credentials and server details
			let rPath = await vscode.window.showInputBox({ prompt: "Enter or select the RestFS URI ", value: RestPath });
			if (rPath != undefined) {
				RestPath = rPath;
				vscode.workspace.getConfiguration("MVBasic").update("RestPath", RestPath, false);
			}
			if (RestPath === "") {
				vscode.window.showInformationMessage('Please configure the RESTFul Path in the workspace settings.');
				return;
			}
			connectRestFS();
		});
	}

	let mvonAdmin = vscode.commands.registerCommand('extension.mvonAdmin', async () => {

		// Create and show a new webview
		const panel = vscode.window.createWebviewPanel(
			'MVON# Administration', // Identifies the type of the webview. Used internally
			'MVON# Administrator', // Title of the panel displayed to the user
			vscode.ViewColumn.One, // Editor column to show the new webview panel in.
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				enableCommandUris: true,

				// And restric the webview to only loading content from our extension's `media` directory.

				localResourceRoots: [

					vscode.Uri.file(path.join(__dirname, '/../../administrator/')).with({ scheme: 'vscode-resource' })
				]
			} // Webview options. More on these later.

		);
		var filePath = __dirname;
		filePath = filePath + "/../../administrator/index.html";
		var admin = fs.readFileSync(filePath, "utf8");
		// set the RestPath for all calls
		if (!RestPath.startsWith("http://localhost/mvonrest")) {
			while (admin.indexOf("http://localhost/mvonrest") > -1) {
				admin = admin.replace("http://localhost/mvonrest", RestPath)
			}
		}
		panel.webview.html = admin;

	});


	// Push the disposable to the context's subscriptions so that the 
	// client can be deactivated on extension deactivation
	context.subscriptions.push(mvonAdmin);
	context.subscriptions.push(disposable);
	context.subscriptions.push(initialiseRestFS);

	if (UsingRest) {		
		let compile = vscode.commands.registerCommand('extension.compileProgram', async () => {
			RESTFS.compile(vscode.window.activeTextEditor.document.uri);
		});
		let compileDebug = vscode.commands.registerCommand('extension.compileDebug', async () => {
			RESTFS.compile(vscode.window.activeTextEditor.document.uri, {debug: true});
		});
		let catalog = vscode.commands.registerCommand('extension.catalogProgram', async () => {
			RESTFS.catalog(vscode.window.activeTextEditor.document.uri);
		});
		context.subscriptions.push(catalog);
		context.subscriptions.push(compile);
		context.subscriptions.push(compileDebug);
	}

	vscode.languages.registerDocumentFormattingEditProvider('mvbasic', {
		provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
			// first work out indents
			// regex for statements that start a block
			var edits: vscode.TextEdit[] = []
			let rBlockStart = new RegExp("^(lock |key\\(|if |commit |rollback |readnext |open |write |writeu |writeuv |read |readv |readu |readvu |matreadu |locate |locate\\(|openseq |matread |create |readlist |openpath |find |findstr |bscan)", "i")
			let rBlockCase = new RegExp("(^begin case)", "i")
			let rBlockTransaction = new RegExp("(^begin transaction|^begin work)", "i")
			let rBlockEndCase = new RegExp("(^end case)", "i")
			let rBlockEndTransaction = new RegExp("(^end transaction|^end work)", "i")
			let rBlockAlways = new RegExp("^(for|loop)", "i")
			let rBlockContinue = new RegExp("(then$|else$|case$|on error$|locked$)", "i")
			let rBlockEnd = new RegExp("^(end|repeat|next\\s.+)$", "i")
			let rElseEnd = new RegExp("^(end else\\s.+)", "i")
			let rLabel = new RegExp("(^[0-9]+\\s)|(^[0-9]+:\\s)|(^[\\w]+:)");
			let rComment = new RegExp("(^\\*.+|^\\s+\\*.+|^!.+|^\\s+!.*|^REM.+|^\\s+REM.+)", "i")
			let tComment = new RegExp("(;\\*.+|;\\s+\\*.+)", "i");
			let lComment = new RegExp("(^[0-9]+\\s+\\*)|(^[0-9]+\\s+;)|(^[0-9]+\\*)|(^[0-9]+;)")  // number label with comments after
			let trailingComment = new RegExp("(\\*.+)|(;+)")
			let spaces = "                                                           "
			if (indent === undefined) { indent = 3 }
			if (margin === undefined) { margin = 5 }


			// first build a list of labels in the program and indentation levels
			let Level = 0
			var RowLevel: number[] = []
			for (var i = 0; i < document.lineCount; i++) {

				let curLine = document.lineAt(i);
				let line = curLine.text;
				if (rComment.test(line.trim()) == true) { continue }
				// TODO ignore comment lines and
				if (line.trim().startsWith("$")) { continue }
				// remove trailing comments

				if (tComment.test(line.trim()) == true) {
					let comment = tComment.exec(line.trim());
					line = line.trim().replace(comment[0], "");

				}
				lComment.lastIndex = 0;
				if (lComment.test(line.trim()) === true) {
					let comment = trailingComment.exec(line.trim());
					if (comment != null) {
						line = line.trim().replace(comment[0], "");
					}
				}
				// check opening and closing block for types
				// check block statements
				var position = i
				RowLevel[i] = Level

				if (rBlockStart.test(line.trim()) == true) {
					Level++
					if (rBlockContinue.test(line.trim()) == false) {
						// single line statement
						Level--
					}
					position = i + 1
				}
				if (rBlockCase.test(line.trim()) == true) {
					// increment 2 to cater for case statement
					Level++
					Level++
					position = i + 1
				}
				if (rBlockEndCase.test(line.trim()) == true) {
					// decrement 2 to cater for case statement
					Level--
					Level--
				}
				if (rElseEnd.test(line.trim()) == true) {
					// decrement 1 to cater for end else stements
					Level--
				}
				if (rBlockTransaction.test(line.trim()) == true) {
					// increment 2 to cater for case statement
					Level++
					position = i + 1
				}
				if (rBlockEndTransaction.test(line.trim()) == true) {
					// decrement 2 to cater for case statement
					Level--
				}
				if (rBlockAlways.test(line.trim())) {
					Level++
					position = i + 1
				}
				if (rBlockEnd.test(line.trim())) {
					Level--
					position = i
				}
				RowLevel[position] = Level
			}
			for (var i = 0; i < document.lineCount; i++) {

				const line = document.lineAt(i);
				// ignore labels
				if (rLabel.test(line.text.trim()) == true) { continue }



				var indentation = 0

				if (RowLevel[i] === undefined) { continue; }

				indentation = (RowLevel[i] * indent) + margin
				if (new RegExp("(^case\\s)", "i").test(line.text.trim()) == true) {
					indentation -= indent
				}
				if (new RegExp("(^while\\s|^until\\s)", "i").test(line.text.trim()) == true) {
					indentation -= indent
				}
				if (new RegExp("(^end else$)", "i").test(line.text.trim()) == true) {
					indentation -= indent
				}
				if (indentation < 0 || formattingEnabled != true) {
					edits.push(vscode.TextEdit.replace(line.range, line.text.trim()))
				}
				else {
					var regEx = "\\s{" + indentation + "}"
					var formattedLine = new RegExp(regEx).exec(spaces)[0] + line.text.trim()
					var formatted = vscode.TextEdit.replace(line.range, formattedLine)
					edits.push(formatted)
				}
			}
			return edits
		}
	});


	// create a decorator type that we use to decorate large numbers
	const customDecoration = vscode.window.createTextEditorDecorationType({
		//cursor: 'crosshair',
		// use a themable color. See package.json for the declaration and default values.
		color: customWordColor
	});

	let activeEditor = vscode.window.activeTextEditor;
	if (activeEditor) {
		triggerUpdateDecorations();
	}

	vscode.window.onDidChangeActiveTextEditor(editor => {
		activeEditor = editor;
		if (editor) {
			triggerUpdateDecorations();
		}
	}, null, context.subscriptions);

	vscode.workspace.onDidChangeTextDocument(event => {
		if (activeEditor && event.document === activeEditor.document) {
			triggerUpdateDecorations();
		}
	}, null, context.subscriptions);

	function triggerUpdateDecorations() {
		if (timeout) {
			clearTimeout(timeout);
		}
		timeout = setTimeout(updateDecorations, 500);
	}

	function updateDecorations() {
		if (!activeEditor) {
			return;
		}
		if (customWordlist == "()") {
			return;
		}
		var regEx = new RegExp("\\b" + customWordlist + "\\b", "g");
		const text = activeEditor.document.getText();
		const customWords: vscode.DecorationOptions[] = [];
		let match;
		while (match = regEx.exec(text)) {
			const startPos = activeEditor.document.positionAt(match.index);
			const endPos = activeEditor.document.positionAt(match.index + match[0].length);
			var hover = customWordDict.get(match[0]);
			const decoration = { range: new vscode.Range(startPos, endPos), hoverMessage: hover };
			customWords.push(decoration)
		}
		activeEditor.setDecorations(customDecoration, customWords);
	}
}

export function deactivate() {
	if (RESTFS) {
		RESTFS.logout();
	}
	RESTFS = undefined;
}
