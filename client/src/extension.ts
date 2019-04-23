/* --------------------------------------------------------------------------------------------
 * Copyright (c) Ongroup International. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import * as path from 'path';
import * as vscode from 'vscode';

import NetObjects = require("./NetObjects")
const MvonFS = require('./MvonFS.js');
const GatewayFS = require("./GatewayFS.js")
import MvonGateway = require("./MvonGateway")

import { workspace, ExtensionContext } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';
import  fs = require('fs')


var terminal: any;
var MvonSession: any;
var UsingGateway: boolean;


export function activate(context: ExtensionContext) {

	// initialise Remote MVON# FileSystem
	const MVONFS = new MvonFS.MvonFS();
	const GATEWAYFS = new GatewayFS.GatewayFS();
	context.subscriptions.push(vscode.workspace.registerFileSystemProvider('MvonFS', MVONFS, { isCaseSensitive: true }));
	context.subscriptions.push(vscode.workspace.registerFileSystemProvider('GatewayFS', GATEWAYFS, { isCaseSensitive: true }));


	// The server is implemented in node
	let serverModule = context.asAbsolutePath(path.join('server', 'server.js'));
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
		documentSelector: [{ scheme: 'file', language: 'mvon' }, { scheme: 'MvonFS', language: 'mvon' }, { scheme: 'GatewayFS', language: 'mvon' }],
		synchronize: {
			// Synchronize the setting section 'languageServerExample' to the server
			configurationSection: 'mvon',
			// Notify the server about file changes to '.clientrc files contain in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	}


	let RemoteCompile: boolean = vscode.workspace.getConfiguration("mvon").get("remoteCompiling");
	let RemoteHost: string = vscode.workspace.getConfiguration("mvon").get("remoteHost");
	let UserName: string = vscode.workspace.getConfiguration("mvon").get("UserName");
	let Password: string = vscode.workspace.getConfiguration("mvon").get("Password");
	let Account: string = vscode.workspace.getConfiguration("mvon").get("Account")
	let AccountPassword: string = vscode.workspace.getConfiguration("mvon").get("AccountPassword")
	let GatewayHost: string = vscode.workspace.getConfiguration("mvon").get("gatewayHost");
	let GatewayPort: number = vscode.workspace.getConfiguration("mvon").get("gatewayPort");
	let GatewayType: string = vscode.workspace.getConfiguration("mvon").get("gatewayType");
	let HomePath: string = vscode.workspace.getConfiguration("mvon").get("homePath");
	let codePage: string = vscode.workspace.getConfiguration("mvon").get("encoding");
	let margin: number = vscode.workspace.getConfiguration("mvon").get("margin");
	let indent: number = vscode.workspace.getConfiguration("mvon").get("indent");
	let formattingEnabled: boolean = vscode.workspace.getConfiguration("mvon").get("formattingEnabled");
	let additionalFiles: any = vscode.workspace.getConfiguration("mvon").get("additionalFiles");
	let gatewayDebug: any = vscode.workspace.getConfiguration("mvon").get("gatewayDebug");
	let customWordColor: any = vscode.workspace.getConfiguration("mvon").get("customWordColor");
	let customWordlist: string = vscode.workspace.getConfiguration("mvon").get("customWords");
	let customWordPath: any = vscode.workspace.getConfiguration("mvon").get("customWordPath");
	let timeout: NodeJS.Timer | null = null;
	var customWordDict = new Map();

	if (customWordPath != "") {
		var contents = fs.readFileSync(customWordPath, 'utf8')
		customWordlist = "(";
		var lines = contents.replace('\r','').split('\n');
		for (let i = 0;i < lines.length;i++)
		{
			let parts = lines[i].split(':')
			customWordDict.set(parts[0].replace("\"","").replace("\"",""),parts[1].replace("\"","").replace("\"",""))
			customWordlist += parts[0].replace('"','').replace("\"","") + "|";
		}
		customWordlist = customWordlist.substr(0,customWordlist.length-1)+")";

	}



	// Create the language client and start the client.
	let disposable = new LanguageClient('mvon', 'MVON# Server', serverOptions, clientOptions).start();
	let initialiseGateway = vscode.commands.registerCommand('extension.initialiseGateway', async () => {
		// Check we have credentials and server details
		if (GatewayHost === "") {
			vscode.window.showInformationMessage('Please configure GatewayHost,GatewayPort,RemoteHost,UserName,Password and Account in Preferences!');
			return;
		}
		



		// Display a message box to the user
		vscode.window.showInformationMessage('Connecting to Gateway' + GatewayHost);
		if (MvonSession === undefined) {
			vscode.window.showInformationMessage("Connecting to MVON# Gateway");
			let gateway = new MvonGateway.GatewayController(GatewayHost, GatewayPort);
			gateway.codePage = "iso8859-1"
			if (codePage != undefined) {
				gateway.codePage = codePage;
			}
			await gateway.OpenConnection(GatewayType, RemoteHost, UserName, Password, Account, AccountPassword, HomePath, gatewayDebug)
			if (gateway.HostConnected === false) {
				vscode.window.showErrorMessage('Error connecting to the Gateway on ' + GatewayHost);
				return;
			}
			if (gateway.Connected === false) {
				vscode.window.showErrorMessage('Error connecting to the Server on ' + RemoteHost);
				return;
			}
			MvonSession = gateway;
		}
		await MvonSession.GetFileList();
		let fileList = MvonSession.Response.split(String.fromCharCode(1));
		fileList.forEach(function (element: string) {
			GATEWAYFS.createDirectory(vscode.Uri.parse('GatewayFS:/' + element + "/"));
		});
		if (additionalFiles != "") {

			additionalFiles.forEach(function (element: string) {
				GATEWAYFS.createDirectory(vscode.Uri.parse('GatewayFS:/' + element + "/"));
			})
		}
		GATEWAYFS.setGateway(MvonSession);
		UsingGateway = true;
		vscode.window.showInformationMessage("Connected to Gateway");
	});

	let initialiseFS = vscode.commands.registerCommand('extension.initialseMVON', async () => {
		// Check we have credentials and server details
		if (RemoteHost === "") {
			vscode.window.showInformationMessage('Please configure RemoteHost,UserName,Password and Account in Preferences!');
			return;
		}


		// Display a message box to the user
		vscode.window.showInformationMessage('Connecting to ' + RemoteHost);
		if (MvonSession === undefined) {
			vscode.window.showInformationMessage("Connecting to MVON# Server");
			let session = new NetObjects.NetSession(RemoteHost, UserName, Password, Account);
			await session.Open();
			MvonSession = session;
		}
		MVONFS.setNetObjects(MvonSession);
		let cmd = MvonSession.CreateCommand();
		cmd.Command = "SELECT VOC WITH F1 LIKE F... AND F4 LIKE Directory...";
		await cmd.Execute();
		let sel = MvonSession.CreateSelectList(0);
		while (true) {
			await sel.Next();
			let id = sel.Response;
			if (!id.endsWith(".Lib") && id != "") {
				MVONFS.createDirectory(vscode.Uri.parse('MvonFS:/' + id + '/'));
			}
			if (sel.LastRecordRead === true) {
				break;
			}

		}
		if (additionalFiles != "") {

			additionalFiles.forEach(function (element: string) {
				MVONFS.createDirectory(vscode.Uri.parse('MvonFS:/' + element + "/"));
			})
		}


		vscode.window.showInformationMessage("Connected");
	});

	// Push the disposable to the context's subscriptions so that the 
	// client can be deactivated on extension deactivation
	context.subscriptions.push(disposable);
	context.subscriptions.push(initialiseFS);

	let compile = vscode.commands.registerCommand('extension.compileProgram', async () => {
		let filePath = vscode.window.activeTextEditor.document.fileName
		// handle linux and OSX file paths
		while (filePath.indexOf("/") > -1) {
			filePath = filePath.replace("/", "\\");
		}
		let parts = filePath.split('\\')
		let fileName = parts[parts.length - 1]
		let programFile = parts[parts.length - 2]

		if (UsingGateway) {
			await MvonSession.Execute("BASIC " + programFile + " " + fileName)
			let response = MvonSession.Response.split(String.fromCharCode(253))
			let message = ""
			for (let i = 0; i < response.length; i++) {
				message += response[i] + "  \r\n"
			}
			vscode.window.showInformationMessage(message);
			return;
		}

		if (RemoteCompile === true) {

			if (MvonSession === undefined) {
				vscode.window.showInformationMessage("Connecting to MVON# Server");
				let session = new NetObjects.NetSession(RemoteHost, UserName, Password, Account);
				await session.Open()
				MvonSession = session
			}

			let cmd = MvonSession.CreateCommand();
			cmd.Command = "BASIC " + programFile + " " + fileName
			await cmd.Execute()
			let response = cmd.Response.split(String.fromCharCode(253))
			let message = ""
			for (let i = 0; i < response.length; i++) {
				message += response[i] + "\r\n"
			}
			let error = message.indexOf("[Line");
			// extract the line the error occured on
			// TODO , other flavours
			if (error > -1) {
				let lineNo = "";
				error += 6
				while (error < message.length) {
					if (message[error] === "]") { break; }
					lineNo += message[error];
					error++;
				}
				const editor = vscode.window.activeTextEditor;
				const position = editor.selection.active;
				var newPosition = position.with(Number(lineNo) - 1, 0);
				var newSelection = new vscode.Selection(newPosition, newPosition);
				editor.selection = newSelection;
				vscode.window.showErrorMessage(message);

			}
			else {
				vscode.window.showInformationMessage(message);
			}
		} else {
			vscode.window.showInformationMessage('Compiling Program!');
			if (terminal == null) {
				terminal = vscode.window.createTerminal("MVON#")
			}
			terminal.sendText("BASIC " + programFile + " " + fileName, true)
		}
	});

	let catalog = vscode.commands.registerCommand('extension.catalogProgram', async () => {
		let filePath = vscode.window.activeTextEditor.document.fileName
		// handle linux and OSX file paths
		while (filePath.indexOf("/") > -1) {
			filePath = filePath.replace("/", "\\");
		}
		let parts = filePath.split('\\')
		let fileName = parts[parts.length - 1]
		let programFile = parts[parts.length - 2]

		if (UsingGateway) {
			await MvonSession.Execute("CATALOG " + programFile + " " + fileName)
			let response = MvonSession.Response.split(String.fromCharCode(253))
			let message = ""
			for (let i = 0; i < response.length; i++) {
				message += response[i] + "  \r\n"
			}
			vscode.window.showInformationMessage(message);
			return;
		}

		if (RemoteCompile === true) {

			if (MvonSession === undefined) {
				vscode.window.showInformationMessage("Connecting to MVON# Server");
				let session = new NetObjects.NetSession(RemoteHost, UserName, Password, Account);
				await session.Open()
				MvonSession = session
			}

			let cmd = MvonSession.CreateCommand();
			cmd.Command = "CATALOG " + programFile + " " + fileName
			await cmd.Execute()
			let response = cmd.Response.split(String.fromCharCode(253))
			let message = ""
			for (let i = 0; i < response.length; i++) {
				message += response[i] + "\r\n"
			}
			vscode.window.showInformationMessage(message);
		} else {
			vscode.window.showInformationMessage('Cataloging Program!');
			if (terminal == null) {
				terminal = vscode.window.createTerminal("MVON#")
			}
			terminal.sendText("CATALOG " + programFile + " " + fileName, true)
		}
	});

	let compileDebug = vscode.commands.registerCommand('extension.compileDebug', async () => {
		let filePath = vscode.window.activeTextEditor.document.fileName
		// handle linux and OSX file paths
		while (filePath.indexOf("/") > -1) {
			filePath = filePath.replace("/", "\\");
		}
		let parts = filePath.split('\\')
		let fileName = parts[parts.length - 1]
		let programFile = parts[parts.length - 2]

		if (RemoteCompile === true) {

			if (MvonSession === undefined) {
				vscode.window.showInformationMessage("Connecting to MVON# Server");
				let session = new NetObjects.NetSession(RemoteHost, UserName, Password, Account);
				await session.Open()
				MvonSession = session
			}

			let cmd = MvonSession.CreateCommand();
			cmd.Command = "BASIC " + programFile + " " + fileName + " (D"
			await cmd.Execute()
			let response = cmd.Response.split(String.fromCharCode(253))
			let message = ""
			for (let i = 0; i < response.length; i++) {
				message += response[i] + "\r\n"
			}
			let error = message.indexOf("[Line");
			// extract the line the error occured on
			// TODO , other flavours
			if (error > -1) {
				let lineNo = "";
				error += 6
				while (error < message.length) {
					if (message[error] === "]") { break; }
					lineNo += message[error];
					error++;
				}
				const editor = vscode.window.activeTextEditor;
				const position = editor.selection.active;
				var newPosition = position.with(Number(lineNo) - 1, 0);
				var newSelection = new vscode.Selection(newPosition, newPosition);
				editor.selection = newSelection;
				vscode.window.showErrorMessage(message);

			}
			else {
				vscode.window.showInformationMessage(message);
			}
		} else {
			vscode.window.showInformationMessage('Compiling Program with Debug');
			if (terminal == null) {
				terminal = vscode.window.createTerminal("MVON#")
			}
			terminal.sendText("BASIC " + programFile + " " + fileName + " (D", true)
		}

	});

	context.subscriptions.push(catalog);
	context.subscriptions.push(compile);
	context.subscriptions.push(compileDebug);
	context.subscriptions.push(initialiseGateway);

	vscode.languages.registerDocumentFormattingEditProvider('mvon', {
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
			let rBlockContinue = new RegExp("(then$|else$|case$|on error$)", "i")
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
					line = line.trim().replace(comment[0], "");
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
			const decoration = { range: new vscode.Range(startPos, endPos), hoverMessage:  hover };
			customWords.push(decoration)
		}
		activeEditor.setDecorations(customDecoration, customWords);
	}
}
