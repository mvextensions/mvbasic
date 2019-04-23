/* --------------------------------------------------------------------------------------------
 * Copyright (c) ONGroup International. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import {
	IPCMessageReader, IPCMessageWriter, createConnection, IConnection, TextDocuments, TextDocument,
	Diagnostic, DiagnosticSeverity, InitializeResult, TextDocumentPositionParams, CompletionItem,
	CompletionItemKind, Location, Range, SymbolInformation, SymbolKind
} from 'vscode-languageserver';


import fs = require('fs');

// Create a connection for the server. The connection uses Node's IPC as a transport
let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

let currentDocument = ""

let useCamelcase = true
let ignoreGotoScope = false;


let shouldSendDiagnosticRelatedInformation: boolean = false;

// After the server has started the client sends an initialize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilities.
connection.onInitialize((_params): InitializeResult => {
	shouldSendDiagnosticRelatedInformation = _params.capabilities && _params.capabilities.textDocument && _params.capabilities.textDocument.publishDiagnostics && _params.capabilities.textDocument.publishDiagnostics.relatedInformation;
	return {
		capabilities: {
			// Tell the client that the server works in FULL text document sync mode
			textDocumentSync: documents.syncKind,
			// Tell the client that the server support code complete
			completionProvider: {
				resolveProvider: true
			},
			definitionProvider: true,
			referencesProvider: true,
			documentSymbolProvider: true

		}
	}
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
	currentDocument = change.document.getText()
	validateTextDocument(change.document);
});

// The settings interface describe the server relevant settings part
interface Settings {
	mvon: ExampleSettings;
}

// These are the example settings we defined in the client's package.json
// file
interface ExampleSettings {
	maxNumberOfProblems: number;
	useCamelCase: boolean;
	ignoreGotoScope: boolean;
	customWords : string;
	customWordPath : string;
}

// hold the maxNumberOfProblems setting
let maxNumberOfProblems: number;
let customWordList: string;
let customWordPath: string;

// The settings have changed. Is send on server activation
// as well.
connection.onDidChangeConfiguration((change) => {
	let settings = <Settings>change.settings;
	maxNumberOfProblems = settings.mvon.maxNumberOfProblems || 100;
	useCamelcase = settings.mvon.useCamelCase
	ignoreGotoScope = settings.mvon.ignoreGotoScope
	customWordList = settings.mvon.customWords
	customWordPath = settings.mvon.customWordPath;
	if (customWordPath != "") {
		var contents = fs.readFileSync(customWordPath, 'utf8')
		customWordList = "(";
		var lines = contents.replace('\r','').split('\n');
		for (let i = 0;i < lines.length;i++)
		{
			let parts = lines[i].split(':')
			customWordList += parts[0].replace('"','').replace("\"","") + "|";
		}
		customWordList = customWordList.substr(0,customWordList.length-1)+")";
		if (contents != "") {
	
		}
	
	}
	// Revalidate any open text documents
	documents.all().forEach(validateTextDocument);
});

// get custom word list

class Label {
	LabelName: string;
	LineNumber: number;
	Level: number;
	Referenced: boolean;
	constructor(LabelName: string, LineNumber: number, Level: number, Referenced: boolean) {
		this.LabelName = LabelName
		this.Level = Level
		this.LineNumber = LineNumber
		this.Referenced = Referenced
	}
}
var LabelList: Label[] = []

function getWord(line: string, wordCount: number): string {
	let xpos = 0
	let startpos = 0
	while (xpos < line.length) {
		if (line.substr(xpos, 1) == " " || line.substr(xpos, 1) == "=") {
			wordCount--
			if (wordCount == 0) {
				return line.substr(startpos, xpos - startpos)
			}
			startpos = xpos + 1
		}

		xpos++
	}
	return line.substr(startpos, xpos - startpos)

}
function validateTextDocument(textDocument: TextDocument): void {
	let diagnostics: Diagnostic[] = [];
	let lines = textDocument.getText().split(/\r?\n/g);
	let problems = 0;
	LabelList.length = 0;
	// regex of all functions
	//let rFunctions = RegExp("\\b(ABS|ABSS|ACCEPTCONNECTION|ACCEPT.SOCKET.CONNECTION|ACTIVEDIRECTORY|ADD.ACCOUNT|ADD.SQL.DATABASE|ADDS|ADDAUTHENTICATIONRULE|ADDREQUESTPARAMETER|ALPHA|ANDS|ASCII|ASSIGNED|BASE64ENCODE|BASE64DECODE|BITXOR|BUILDJSON|CACHE|CLEARCACHE|CATALOGUED|CATS|FUNNY|CHANGE|CHECKSUM|CHAR|HELPME|CLOSESOCKET|COMPARE|CONVERT|COL1|COL2|COUNT|COUNTS|CREATE.SERVER.SOCKET|CREATE.FOLDER|CREATEREQUEST|CREATESECUREREQUEST|CREATESECURITYCONTEXT|DATE|DCOUNT|DELETE|DELETEU|DELETEPH|DIV|DIVS|DOWNCASE|DQUOTE|EBCDIC|EMAIL|ENCODE|ENCRYPT|EREPLACE|EXTRACT|EQS|FILE.COPY|FILE.MOVE|FILE.DELETE|GROUP|KEYIN|LEFT|LEN|LENS|LISTU|LOWER|NOT|FADD|FCORRELATIVE|FIELD|FIELDS|FIELDSTORE|FILE.COPY|FILE.DELETE|FILE.MOVE|FILEINFO|FIX|FMT|FMTS|FOLD|GETUSERNAME|GTS|GUID|ICONV|ICONVS|IFS|IN|INDEX|INDICES|INITSERVERSOCKET|INLIST|INMAT|INSERT|INT|ISNULL|ISINDEX|ITYPE|KEYIN|LOCATE|LISTU|LISTREADU|LISTREADF|LTS|MESSAGE|MATCHFIELD|MAX|MAXIMUM|MINIMUM|MOD|MULS|NEG|NEGS|NOT|NUM|OCONV|OCONVS|OPEN.QUEUE|OPEN.SOCKET|PARSEBASIC|PARSEJSON|PARSESTRING|PASSWD|PATTERNMATCH|PCLTOPDF|PDFADDIMAGE|PDFOVERLAY|PDFPROTECT|PROCESS|PROTOCOLLOGGING|PWR|QUEUE.LENGTH|QUOTE|RAISE|RANDOMIZE|READSOCKET|READ.QUEUE|READ.SOCKET|RECORDLOCKED|REMOVE|REPLACE|REUSE|RIGHT|REGEX|REM|RND|SELECTINFO|SENTENCE|SEQ|SET.SQLDATABASE|SETHTTPDEFAULT|SETREQUESTHEADER|SOCKET.LISTENING|SOCKET.ESTABLISHED|SPACE|SPACES|SPLICE|STACK.PUSH|STACK.POP|SQUOTE|SQRT|STATUS|STOREDPROCEDURE|STR|SUBMITREQUEST|SUBR|SUBS|SUBSTRINGS|SUM|SUMMATION|SYSTEM|TABLEADD|TABLEGET|TABLEFIND|TABLECLEAR|TABLEREMOVE|TIME|TIMEDATE|TRANS|TRIM|TRIMB|TRIMF|TRIMS|TRIMBS|UPCASE|UNASSIGNED|WRITESOCKET|WRITE.SOCKET|WRITE.QUEUE)(\\()")
	// regex to extract labels
	//let rLabel = new RegExp("(^[0-9]+\\b)|(^[0-9]+)|(^[0-9]+:\\s)|(^[\\w\\.]+:)");
	let rLabel = new RegExp("(^[0-9]+\\b)|(^[0-9]+)|(^[0-9]+:\\s)|(^[\\w\\.]+:(?!\\=))","i")
	// regex for statements that start a block
	let rBlockStart = new RegExp("(^if |begin case|^readnext |open |read |readv |readu |locate |openseq |matread |create |readlist |openpath |find |findstr )", "i")
	let rBlockAlways = new RegExp("(^for |^loop)", "i")
	let rBlockContinue = new RegExp("(then$|else$|case$|on error$)", "i")
	let rBlockEnd = new RegExp("^(end|end case|repeat|.+repeat$|next\\s.+)$", "i")
	let rStartFor = new RegExp("^(for )", "i")
	let rStartLoop = new RegExp("(^loop)", "i")
	let rStartCase = new RegExp("(^begin case)", "i")
	let rEndFor = new RegExp("(^next\\s)", "i")
	let rEndLoop = new RegExp("(repeat$)", "i")
	let rEndCase = new RegExp("(^end case)", "i")
	let rElseEnd = new RegExp("^(end else\\s.+)", "i")
	let rComment = new RegExp("(^\\*.+|^\\s+\\*.+|^!.+|^\\s+!.+|^REM.+|^\\s+REM.+)", "i")
	let tComment = new RegExp("(;\\*.+|;\\s+\\*.+)", "i");
	let lComment = new RegExp("(^[0-9]+\\s+\\*)|(^[0-9]+\\s+;)|(^[0-9]+\\*)|(^[0-9]+;)")  // number label with comments after
	let trailingComment = new RegExp("(\\*.+)|(;+)")
	let qStrings = new RegExp("(\"([^\"]|\"\")*\")|('([^']|'')*')|(\\\\([^\\\\]|\\\\\\\\)*\\\\)", "g");
	let noFor = 0;
	let noCase = 0;
	let noLoop = 0;
	let noEndFor = 0;
	let noEndLoop = 0;
	let noEndCase = 0;
	let ForSequence = ""
	// first build a list of labels in the program and indentation levels
	let Level = 0
	var RowLevel: number[] = [lines.length]
	for (var i = 0; i < lines.length && problems < maxNumberOfProblems; i++) {
		let line = lines[i];
		// ignore all comment lines
		if (rComment.test(line.trim()) === true) { continue }
		// remove trailing comments
		if (tComment.test(line.trim()) === true) {
			let comment = tComment.exec(line.trim());
			line = line.trim().replace(comment[0], "");

		}
		// remove comments after label
		lComment.lastIndex = 0;
		if (lComment.test(line.trim()) === true) {
			let comment = trailingComment.exec(line.trim());
			if (comment != null) {
				line = line.trim().replace(comment[0], "");
			}
		}

		// check opening and closing block for types
		let forvar = ""
		let nextvar = ""
		if (rStartFor.test(line.trim()) == true) {
			noFor++
			forvar = getWord(line.trim(), 2)
			ForSequence += i + "~+" + forvar + "|"

		}
		if (rEndFor.test(line.trim()) == true) {
			noEndFor++
			nextvar = getWord(line.trim(), 2)
			ForSequence += i + "~-" + nextvar + "|"

		}
		if (rStartCase.test(line.trim()) == true) { noCase++ }
		if (rEndCase.test(line.trim()) == true) { noEndCase++ }
		if (rStartLoop.test(line.trim()) == true) { noLoop++ }
		if (rEndLoop.test(line.trim()) == true) { noEndLoop++ }
		// check block statements
		if (rBlockStart.test(line.trim()) == true) {
			Level++
			if (rBlockContinue.test(line.trim()) == false) {
				// single line statement
				Level--
			}

		} ``
		if (rBlockAlways.test(line.trim())) {
			Level++
		}
		if (rBlockEnd.test(line.trim())) {
			Level--
		}
		if (rElseEnd.test(line.trim()) == true) {
			// decrement 1 to cater for end else stements
			Level--
		}
		// 10  10:  start: labels
		if (rLabel.test(line.trim()) === true) {
			let label = rLabel.exec(line.trim())[0].trim().replace(":", "");
			LabelList.push(new Label(label, i, Level, false))
		}
		RowLevel[i] = Level
	}
	// if we have unmatched specific blocks then display error
	if (noFor != noEndFor) {
		// find the innermost for
		// split out lines and remove matching for/nexts
		let parts = ForSequence.split('|')
		while (true) {
			let exitFlag = true
			for (var i = 0; i < parts.length - 1; i++) {
				if (parts[i] != '') {
					let begin = parts[i].split('~')
					if (begin[1].substr(0, 1) == "-") {
						//ignore next
						continue
					}
					if (parts[i + 1] != '') {
						let end = parts[i + 1].split('~')
						if (begin[1].replace('+', '') == end[1].replace('-', '')) {
							exitFlag = false
							parts.splice(i, 1)
							parts.splice(i, 1)
							exitFlag = false
							break
						}
					}
				}
			}
			if (exitFlag == true) { break }

		}
		// check forward for any nested for/next
		while (true) {
			let exitFlag = true
			for (var i = 0; i < parts.length - 1; i++) {
				if (parts[i] != '') {
					let begin = parts[i].split('~')
					for (var k = i + 1; k < parts.length; k++) {
						if (parts[k] != '') {
							let end = parts[k].split('~')
							if (begin[1].replace('+', '') == end[1].replace('-', '')) {
								exitFlag = false
								parts.splice(k, 1)
								parts.splice(i, 1)
								exitFlag = false
								break
							}
						}
					}
				}
			}
			if (exitFlag == true) { break }

		}
		// we now have a list of unmatched for/next and their locations
		for (var i = 0; i < parts.length; i++) {
			if (parts[i] != "") {
				let unmatched = parts[i].split('~')
				let errorMsg = ''
				if (unmatched[1].substr(0, 1) == '+') {
					errorMsg = "Missing NEXT Statement"
				} else {
					errorMsg = "Missing FOR Statement"
				}
				let lineNo = Number(unmatched[0])
				let diagnosic: Diagnostic = {
					severity: DiagnosticSeverity.Error,
					range: {

						start: { line: lineNo, character: 0 },
						end: { line: lineNo, character: lines[lineNo].length }
					},
					message: errorMsg,
					source: 'mvon#'
				};
				if (shouldSendDiagnosticRelatedInformation) {
					diagnosic.relatedInformation = [
						{
							location: {
								uri: textDocument.uri,
								range: {
									start: { line: lineNo, character: 0 },
									end: { line: lineNo, character: lines[lineNo].length }
								}
							},
							message: errorMsg
						}
					];
				}
				diagnostics.push(diagnosic);
			}
		}


	}
	if (noCase != noEndCase) {
		// find the innermost for
		let line = ''
		for (var i = 0; i < lines.length && problems < maxNumberOfProblems; i++) {
			line = lines[i];
			if (rStartCase.test(line.trim()) == true) { noCase-- }
			if (noCase == 0) { break }
		}
		let diagnosic: Diagnostic = {
			severity: DiagnosticSeverity.Error,
			range: {
				start: { line: i, character: 0 },
				end: { line: i, character: lines[i].length }
			},
			message: `Missing END CASE statement`,
			source: 'mvon#'
		};
		if (shouldSendDiagnosticRelatedInformation) {
			diagnosic.relatedInformation = [
				{
					location: {
						uri: textDocument.uri,
						range: {
							start: { line: i, character: 0 },
							end: { line: i, character: lines[i].length }
						}
					},
					message: 'Missing END CASE statement'
				}
			];
		}
		diagnostics.push(diagnosic);


	}
	if (noLoop != noEndLoop) {

		// find the innermost for
		let line = ''
		for (var i = 0; i < lines.length && problems < maxNumberOfProblems; i++) {
			line = lines[i];
			if (rStartLoop.test(line.trim()) == true) { noLoop-- }
			if (noLoop == 0) { break }
		}
		let diagnosic: Diagnostic = {
			severity: DiagnosticSeverity.Error,
			range: {
				start: { line: i, character: 0 },
				end: { line: i, character: lines[i].length }
			},
			message: `Missing REPEAT statement`,
			source: 'mvon#'
		};
		if (shouldSendDiagnosticRelatedInformation) {
			diagnosic.relatedInformation = [
				{
					location: {
						uri: textDocument.uri,
						range: {
							start: { line: i, character: 0 },
							end: { line: i, character: lines[i].length }
						}
					},
					message: 'Missing REPEAT statement'
				}
			];
		}
		diagnostics.push(diagnosic);

	}
	// if Level is != 0, we have mis matched code blocks
	if (Level > 0) {

		let lastLineLength = lines[lines.length - 1].length

		let diagnosic: Diagnostic = {
			severity: DiagnosticSeverity.Error,
			range: {
				start: { line: lines.length, character: 0 },
				end: { line: lines.length, character: lastLineLength }
			},
			message: `Missing END, END CASE or REPEAT statements`,
			source: 'ex'
		};
		if (shouldSendDiagnosticRelatedInformation) {
			diagnosic.relatedInformation = [
				{
					location: {
						uri: textDocument.uri,
						range: {
							start: { line: lines.length, character: 0 },
							end: { line: i, character: lastLineLength }
						}
					},
					message: 'One of the code blocks is missing an END'
				}
			];
		}
		diagnostics.push(diagnosic);
	}
	// regex to check for goto/gosub in a line
	let rGoto = new RegExp('((gosub|goto|go|go to)\\s\\w+)', "ig");
	for (var i = 0; i < lines.length && problems < maxNumberOfProblems; i++) {
		let line = lines[i];
		// ignore comment lines
		if (rComment.test(line.trim()) == true) {
			continue
		}
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
		// remove any quoted string
		qStrings.lastIndex = 0;
		while (qStrings.test(line) == true) {
			qStrings.lastIndex = 0;
			let str = qStrings.exec(line);
			line = line.replace(str[0], "");
			qStrings.lastIndex = 0;
		}

		// check any gosubs or goto's to ensure label is present
		rGoto.lastIndex = 0;
		if (rGoto.test(line.trim()) == true) {
			while (line.indexOf(",") > -1) {
				line = line.replace(",", " ");
			}
			let values = line.replace(";", " ").split(' ')
			let found = false
			let labelName = ""
			let checkLabel = ""
			let cnt = 0
			values.forEach(function (value) {
				cnt++
				if (value.toLowerCase() == "goto" || value.toLowerCase() == "gosub" || value.toLowerCase() == "go") {
					while (cnt < values.length) {
						labelName = values[cnt].replace(";", "").replace("*", "");
						if (labelName === "to") {
							cnt++;
							labelName = values[cnt].replace(";", "").replace("*", "");
						}
						LabelList.forEach(function (label) {
							checkLabel = label.LabelName;
							if (checkLabel == labelName) {
								found = true
								// set the referened flag
								label.Referenced = true;
								if (label.Level != RowLevel[i] && label.Level > 1 && ignoreGotoScope === false) {
									// jumping into or out of a loop
									let index = line.indexOf(labelName)
									let diagnosic: Diagnostic = {
										severity: DiagnosticSeverity.Error,
										range: {
											start: { line: i, character: index },
											end: { line: i, character: index + labelName.length }
										},
										message: `${labelName} is trying to go out of scope`,
										source: 'ex'
									};
									if (shouldSendDiagnosticRelatedInformation) {
										diagnosic.relatedInformation = [
											{
												location: {
													uri: textDocument.uri,
													range: {
														start: { line: i, character: index },
														end: { line: i, character: index + labelName.length }
													}
												},
												message: 'Invalid GOTO or GOSUB, jumping into/out of a block'
											}
										];
									}
									diagnostics.push(diagnosic);
								}
							}
						});
						cnt++;
						if (!found) {
							let index = line.indexOf(labelName)
							let diagnosic: Diagnostic = {
								severity: DiagnosticSeverity.Error,
								range: {
									start: { line: i, character: index },
									end: { line: i, character: index + labelName.length }
								},
								message: `${labelName} is not defined as a label in the program`,
								source: 'mvon#'
							};
							if (shouldSendDiagnosticRelatedInformation) {
								diagnosic.relatedInformation = [
									{
										location: {
											uri: textDocument.uri,
											range: {
												start: { line: i, character: index },
												end: { line: i, character: index + labelName.length }
											}
										},
										message: 'Invalid GOTO or GOSUB'
									}
								];
							}
							diagnostics.push(diagnosic);
						}
					}
				}
			});

		}

	}
	// check for unreferenced labels
	LabelList.forEach(function (label) {
		if (label.Referenced === false) {
			let diagnosic: Diagnostic = {
				severity: DiagnosticSeverity.Warning,
				range: {
					start: { line: label.LineNumber, character: 0 },
					end: { line: label.LineNumber, character: label.LabelName.length }
				},
				message: `${label.LabelName} is not referenced in the program`,
				source: 'mvon#'
			};
			if (shouldSendDiagnosticRelatedInformation) {
				diagnosic.relatedInformation = [
					{
						location: {
							uri: textDocument.uri,
							range: {
								start: { line: label.LineNumber, character: 0 },
								end: { line: label.LineNumber, character: label.LabelName.length }
							}
						},
						message: 'Label no referenced in the program'
					}
				];
			}
			diagnostics.push(diagnosic);

		}
	})
	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles((_change) => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion((_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
	// The pass parameter contains the position of the text document in
	// which code complete got requested. For the example we ignore this
	// info and always provide the same completion items.
	// if the previous word is GOTO GOSUB or GO TO make a list of labels available
	let lineNo = _textDocumentPosition.position.line;
	let charCount = _textDocumentPosition.position.character;
	let document = documents.get(_textDocumentPosition.textDocument.uri);
	let lines = document.getText().split(/\r?\n/g);
	let line = lines[lineNo].toLocaleLowerCase().replace("go to", "goto");
	while (charCount > 0) {
		charCount--;
		let statement = "";
		if (line[charCount] != " ") {
			let wordStart = charCount;
			while (charCount > 0) {
				charCount--;
				if (line[charCount] === " ") {
					break;
				}
			}
			if (charCount === 0) {
				charCount--;
			}
			statement = line.substr(charCount + 1, wordStart - charCount)
			let result: CompletionItem[] = [];
			if (statement.toLocaleLowerCase() === "gosub" || statement.toLocaleLowerCase() === "goto") {
				for (let i = 0; i < LabelList.length; i++) {
					result.push({ label: LabelList[i].LabelName, kind: CompletionItemKind.Reference, data: 999 })
				}
				return result
			}
		}
	}

	if (useCamelcase === false) {
		let result: CompletionItem[] = [];
		result = [
			{ label: 'FOR', kind: CompletionItemKind.Function, data: 1 },
			{ label: 'OPEN', kind: CompletionItemKind.Function, data: 2 },
			{ label: 'DCOUNT', kind: CompletionItemKind.Function, data: 3 },
			{ label: 'DATE', kind: CompletionItemKind.Function, data: 4 },
			{ label: 'SELECT', kind: CompletionItemKind.Function, data: 5 },
			{ label: 'READNEXT', kind: CompletionItemKind.Function, data: 6 },
			{ label: 'READ', kind: CompletionItemKind.Function, data: 7 },
			{ label: 'READV', kind: CompletionItemKind.Function, data: 8 },
			{ label: 'REPEAT', kind: CompletionItemKind.Function, data: 9 },
			{ label: 'CRT', kind: CompletionItemKind.Function, data: 10 },
			{ label: 'DIM', kind: CompletionItemKind.Function, data: 11 },
			{ label: 'DEBUG', kind: CompletionItemKind.Function, data: 12 },
			{ label: 'CALL', kind: CompletionItemKind.Function, data: 13 },
			{ label: 'TRIM', kind: CompletionItemKind.Function, data: 14 },
			{ label: 'TRIMF', kind: CompletionItemKind.Function, data: 15 },
			{ label: 'TRIMB', kind: CompletionItemKind.Function, data: 16 },
			{ label: 'LEN', kind: CompletionItemKind.Function, data: 17 },
			{ label: 'MAT', kind: CompletionItemKind.Function, data: 18 },
			{ label: 'MATCHES', kind: CompletionItemKind.Function, data: 19 },
			{ label: 'WRITE', kind: CompletionItemKind.Function, data: 20 },
			{ label: 'WRITEV', kind: CompletionItemKind.Function, data: 21 },
			{ label: 'BEGIN CASE', kind: CompletionItemKind.Function, data: 22 },
			{ label: 'CASE', kind: CompletionItemKind.Function, data: 23 },
			{ label: 'ABS', kind: CompletionItemKind.Function, data: 24 },
			{ label: 'INDEX', kind: CompletionItemKind.Function, data: 25 },
			{ label: '@AM', kind: CompletionItemKind.Function, data: 26 },
			{ label: '@VM', kind: CompletionItemKind.Function, data: 27 },
			{ label: '@SVM', kind: CompletionItemKind.Function, data: 28 },
			{ label: '@TM', kind: CompletionItemKind.Function, data: 29 },
			{ label: 'LOOP', kind: CompletionItemKind.Function, data: 30 },
			{ label: 'END CASE', kind: CompletionItemKind.Function, data: 31 },
			{ label: 'GOSUB', kind: CompletionItemKind.Function, data: 33 },
			{ label: 'END', kind: CompletionItemKind.Function, data: 34 },
			{ label: 'UPCASE', kind: CompletionItemKind.Function, data: 35 },
			{ label: 'DOWNCASE', kind: CompletionItemKind.Function, data: 36 },
			{ label: 'DQUOTE', kind: CompletionItemKind.Function, data: 37 },
			{ label: 'SQUOTE', kind: CompletionItemKind.Function, data: 38 },
			{ label: 'PRINT', kind: CompletionItemKind.Function, data: 39 },
			{ label: 'PRINTER ON', kind: CompletionItemKind.Function, data: 40 },
			{ label: 'PRINTER OFF', kind: CompletionItemKind.Function, data: 41 },
			{ label: 'PRINTER CLOSE', kind: CompletionItemKind.Function, data: 42 },
			{ label: 'OCONV', kind: CompletionItemKind.Function, data: 43 },
			{ label: 'ICONV', kind: CompletionItemKind.Function, data: 44 },
			{ label: 'INT', kind: CompletionItemKind.Function, data: 45 },
			{ label: '$INCLUDE', kind: CompletionItemKind.Function, data: 46 },
			{ label: 'NEXT', kind: CompletionItemKind.Function, data: 47 },
			{ label: 'CONTINUE', kind: CompletionItemKind.Function, data: 48 },
			{ label: 'RETURN', kind: CompletionItemKind.Function, data: 49 },
			{ label: 'EXIT', kind: CompletionItemKind.Function, data: 50 },
			{ label: 'CHANGE', kind: CompletionItemKind.Function, data: 51 },
			{ label: 'LOWER', kind: CompletionItemKind.Function, data: 52 },
			{ label: 'RAISE', kind: CompletionItemKind.Function, data: 53 },
			{ label: 'DELETE', kind: CompletionItemKind.Function, data: 54 },
			{ label: 'CONVERT', kind: CompletionItemKind.Function, data: 55 },
			{ label: 'BEGIN TRANSACTION', kind: CompletionItemKind.Function, data: 56 },
			{ label: 'END TRANSACTION', kind: CompletionItemKind.Function, data: 57 },
			{ label: 'COMMIT', kind: CompletionItemKind.Function, data: 58 },
			{ label: 'ROLLBACK', kind: CompletionItemKind.Function, data: 59 },
			{ label: 'READU', kind: CompletionItemKind.Function, data: 60 },
			{ label: 'WRITEU', kind: CompletionItemKind.Function, data: 61 },
			{ label: 'PROGRAM', kind: CompletionItemKind.Function, data: 62 },
			{ label: 'SUBROUTINE', kind: CompletionItemKind.Function, data: 63 },
			{ label: 'END ELSE', kind: CompletionItemKind.Function, data: 64 },
			{ label: 'READLIST', kind: CompletionItemKind.Function, data: 65 },
			{ label: 'UNTIL', kind: CompletionItemKind.Function, data: 66 },
			{ label: 'WHILE', kind: CompletionItemKind.Function, data: 67 },
			{ label: 'GOTO', kind: CompletionItemKind.Function, data: 68 },
			{ label: 'DELETE', kind: CompletionItemKind.Function, data: 69 },
			{ label: 'UNASSIGNED', kind: CompletionItemKind.Function, data: 70 },
			{ label: 'RELEASE', kind: CompletionItemKind.Function, data: 71 },
			{ label: 'STOP', kind: CompletionItemKind.Function, data: 72 },
			{ label: 'EQU', kind: CompletionItemKind.Function, data: 73 },
			{ label: 'EQUATE', kind: CompletionItemKind.Function, data: 74 },
		]

		var items = customWordList.split('|');
		for (let i=0;i <items.length;i++)
		{
			result.push({ label: items[i], kind: CompletionItemKind.Interface, data: 999 })

		}
		return result;
	} else {
		let result: CompletionItem[] = [];
		result = [
			{ label: 'For', kind: CompletionItemKind.Function, data: 1 },
			{ label: 'Open', kind: CompletionItemKind.Function, data: 2 },
			{ label: 'Dcount', kind: CompletionItemKind.Function, data: 3 },
			{ label: 'Date', kind: CompletionItemKind.Function, data: 4 },
			{ label: 'Select', kind: CompletionItemKind.Function, data: 5 },
			{ label: 'ReadNext', kind: CompletionItemKind.Function, data: 6 },
			{ label: 'Read', kind: CompletionItemKind.Function, data: 7 },
			{ label: 'Readv', kind: CompletionItemKind.Function, data: 8 },
			{ label: 'Repeat', kind: CompletionItemKind.Function, data: 9 },
			{ label: 'Crt', kind: CompletionItemKind.Function, data: 10 },
			{ label: 'Dim', kind: CompletionItemKind.Function, data: 11 },
			{ label: 'Debug', kind: CompletionItemKind.Function, data: 12 },
			{ label: 'Call', kind: CompletionItemKind.Function, data: 13 },
			{ label: 'Trim', kind: CompletionItemKind.Function, data: 14 },
			{ label: 'Trimf', kind: CompletionItemKind.Function, data: 15 },
			{ label: 'Trimb', kind: CompletionItemKind.Function, data: 16 },
			{ label: 'Len', kind: CompletionItemKind.Function, data: 17 },
			{ label: 'Mat', kind: CompletionItemKind.Function, data: 18 },
			{ label: 'Matches', kind: CompletionItemKind.Function, data: 19 },
			{ label: 'Write', kind: CompletionItemKind.Function, data: 20 },
			{ label: 'Writev', kind: CompletionItemKind.Function, data: 21 },
			{ label: 'Begin Case', kind: CompletionItemKind.Function, data: 22 },
			{ label: 'Case', kind: CompletionItemKind.Function, data: 23 },
			{ label: 'Abs', kind: CompletionItemKind.Function, data: 24 },
			{ label: 'Index', kind: CompletionItemKind.Function, data: 25 },
			{ label: '@@Am', kind: CompletionItemKind.Function, data: 26 },
			{ label: '@Vm', kind: CompletionItemKind.Function, data: 27 },
			{ label: '@Svm', kind: CompletionItemKind.Function, data: 28 },
			{ label: '@Tm', kind: CompletionItemKind.Function, data: 29 },
			{ label: 'Loop', kind: CompletionItemKind.Function, data: 30 },
			{ label: 'End Case', kind: CompletionItemKind.Function, data: 31 },
			{ label: 'Gosub', kind: CompletionItemKind.Function, data: 33 },
			{ label: 'End', kind: CompletionItemKind.Function, data: 34 },
			{ label: 'Upcase', kind: CompletionItemKind.Function, data: 35 },
			{ label: 'Downcase', kind: CompletionItemKind.Function, data: 36 },
			{ label: 'Dquote', kind: CompletionItemKind.Function, data: 37 },
			{ label: 'Squote', kind: CompletionItemKind.Function, data: 38 },
			{ label: 'Print', kind: CompletionItemKind.Function, data: 39 },
			{ label: 'Printer On', kind: CompletionItemKind.Function, data: 40 },
			{ label: 'Printer Off', kind: CompletionItemKind.Function, data: 41 },
			{ label: 'Printer Close', kind: CompletionItemKind.Function, data: 42 },
			{ label: 'Oconv', kind: CompletionItemKind.Function, data: 43 },
			{ label: 'Iconv', kind: CompletionItemKind.Function, data: 44 },
			{ label: 'Int', kind: CompletionItemKind.Function, data: 45 },
			{ label: '$Include', kind: CompletionItemKind.Function, data: 46 },
			{ label: 'Next', kind: CompletionItemKind.Function, data: 47 },
			{ label: 'Continue', kind: CompletionItemKind.Function, data: 48 },
			{ label: 'Return', kind: CompletionItemKind.Function, data: 49 },
			{ label: 'Exit', kind: CompletionItemKind.Function, data: 50 },
			{ label: 'Change', kind: CompletionItemKind.Function, data: 51 },
			{ label: 'Lower', kind: CompletionItemKind.Function, data: 52 },
			{ label: 'Raise', kind: CompletionItemKind.Function, data: 53 },
			{ label: 'Delete', kind: CompletionItemKind.Function, data: 54 },
			{ label: 'Convert', kind: CompletionItemKind.Function, data: 55 },
			{ label: 'Begin Transaction', kind: CompletionItemKind.Function, data: 56 },
			{ label: 'End Transaction', kind: CompletionItemKind.Function, data: 57 },
			{ label: 'Commit', kind: CompletionItemKind.Function, data: 58 },
			{ label: 'Rollback', kind: CompletionItemKind.Function, data: 59 },
			{ label: 'Readu', kind: CompletionItemKind.Function, data: 60 },
			{ label: 'Writeu', kind: CompletionItemKind.Function, data: 61 },
			{ label: 'Program', kind: CompletionItemKind.Function, data: 62 },
			{ label: 'Subroutine', kind: CompletionItemKind.Function, data: 63 },
			{ label: 'End Else', kind: CompletionItemKind.Function, data: 64 },
			{ label: 'Readlist', kind: CompletionItemKind.Function, data: 65 },
			{ label: 'Until', kind: CompletionItemKind.Function, data: 66 },
			{ label: 'While', kind: CompletionItemKind.Function, data: 67 },
			{ label: 'Goto', kind: CompletionItemKind.Function, data: 68 },
			{ label: 'Delete', kind: CompletionItemKind.Function, data: 69 },
			{ label: 'Unassigned', kind: CompletionItemKind.Function, data: 70 },
			{ label: 'Release', kind: CompletionItemKind.Function, data: 71 },
			{ label: 'Stop', kind: CompletionItemKind.Function, data: 72 },
			{ label: 'Equ', kind: CompletionItemKind.Function, data: 73 },
			{ label: 'Equate', kind: CompletionItemKind.Function, data: 74 },
		]
		
		let items = customWordList.substring(1,customWordList.length-1).split('|');
		for (let i=0;i <items.length;i++)
		{
			result.push({ label: items[i], kind: CompletionItemKind.Interface, data: 999 })

		}
		return result;

	}
});

// This handler resolve additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
	switch (item.data) {
		case 1:
			item.documentation = "The FOR statement begin a FOR/NEXT Loop"
			item.detail = "FOR var = start TO end {STEP incr}\r\n\r\n{UNTIL/WHITE condition}\r\nNEXT var"
			break
		case 2:
			item.documentation = "The OPEN statement opens a file for data processing.\r\nIf the OPEN statement fails, it executes any statements associated with an ELSE clause. If the OPEN is successful it will execute any statements associated with a THEN clause. Note that either one or both of the THEN and ELSE clauses are required."
			item.detail = "OPEN {'DICT'},filename TO filevariable {ON ERROR} THEN/ELSE"
			break
		case 3:
			item.documentation = "The DCOUNT function counts the number of delimited elements in an expression."
			item.detail = "DCOUNT(expr1,Expr2)"
			break
		case 4:
			item.documentation = "The internal form of the date is expressed as the number of days before or since December 31, 1967. The internal format of December 31, 1967 is zero, any day before is returned as a negative number any day past is returned as a positive number."
			item.detail = "DATE()"
			break
		case 5:
			item.documentation = "The SELECT statement creates a select list of elements in a specified variable or list number"
			item.detail = "SELECT filevariable TO listnum\r\nSELECT filevariable TO variable"
			break;
		case 6:
			item.documentation = "The READNEXT statement reads the next entry from a list number or variable. If no list number or variable is specified, the default listy '0' is used. If an entry is available the THEN clause is execute otherwise the ELSE clause is executed"
			item.detail = "READNEXT var FROM listnumber THEN/ELSE\r\nREADNEXT var from variable THEN/ELSE"
			break;
		case 7:
			item.documentation = "The READ statement reads a record from a file with supplied key. If the key exists the THEN statements are executed otherwise the ELSE statements are executed. the ON ERROR clause is executed if am error occurs during the READ process."
			item.detail = "READ record FROM filevariable, key {ON ERROR} THEN/ELSE"
			break;
		case 8:
			item.documentation = "The READV statement reads an attribute from a record from a file with supplied key. If the key exists the THEN statements are executed otherwise the ELSE statements are executed. the ON ERROR clause is executed if am error occurs during the READ process."
			item.detail = "READV record FROM filevariable, key, attribute {ON ERROR} THEN/ELSE"
			break;
		case 9:
			item.documentation = "The REPEAT statement marks the end of a LOOP statement"
			item.detail = "REPEAT"
			break
		case 10:
			item.documentation = "The CRT statement displays text to terminal window. If the optional ':' is appended no carraige return is appended to the text"
			item.detail = "CRT expression\r\nCRT expression:"
			break
		case 11:
			item.documentation = "The DIM statement creates a dimessioned array with supplied no of elements. A dimensioned array can be single or multidemension."
			item.detail = "DIM variable(depth)\r\nDIM variable(depth,width)"
			break
		case 12:
			item.documentation = "The DEBUG statement forces a program to enter the debugger at a specific point. This only applies if the program has been compiled in debug mode.\r\nBASIC filename programname (D"
			item.detail = "DEBUG"
			break
		case 13:
			item.documentation = "The CALL statement passes program execution to another subroutine. The subroutine must be compiled and cataloged."
			item.detail = "CALL subroutine{(arg1,arg2,...)}\r\nCALL @variable{(arg1,arg2,...)}"
			break
		case 14:
			item.documentation = "The TRIM function removes all leading and trailing white space from a string"
			item.detail = "TRIM(expression)"
			break;
		case 15:
			item.documentation = "The TRIMF function removes all leading white space from a string"
			item.detail = "TRIMF(expression)"
			break;
		case 16:
			item.documentation = "The TRIMB function removes all triling white space from a string"
			item.detail = "TRIMB(expression)"
			break;
		case 17:
			item.documentation = "The LEN function return the length of a string"
			item.detail = "LEN(expression)"
			break;
		case 18:
			item.documentation = "The MAT statement allows you to initiase all the elements of an array to a specific value"
			item.detail = "MAT variable = expression"
			break
		case 19:
			item.documentation = "The pattern matching operator, MATCH, and its synonym, MATCHES, compare a string expression to a pattern."
			item.detail = "expression MATCH/MATCHES pattern"
			break;
		case 20:
			item.documentation = "The WRITE statement writes a record to file using the specified key. The file must be opened before the WRITE statement can be used. If an error occurs the ON ERROR clause is executed"
			item.detail = "WRITE record ON filevariable , key {ON ERROR}"
			break;
		case 21:
			item.documentation = "The WRITEV statement writes an attribute to file using the specified key and attribute number. The file must be opened before the WRITE statement can be used. If an error occurs the ON ERROR clause is executed"
			item.detail = "WRITEV record ON filevariable , key , attribute {ON ERROR}"
			break;
		case 22:
			item.documentation = "The BEGIN CASE statement starts a case block. The block is terminates with an END CASE statement."
			item.detail = "BEGIN CASE\r\n\r\n...\r\nEND CASE"
			break;
		case 23:
			item.documentation = "The CASE statement performs a test and if it resolves to true, all statement below the CASE are executed until the next CASE statement or END CASE statement"
			item.detail = "CASE expr operator value"
			break;
		case 24:
			item.documentation = "The ABS function returns the absolute value of an expression"
			item.detail = "ABS(expression)"
			break;
		case 25:
			item.documentation = "The INDEX function returns the position of a sub string in a string. The optional occurance value set the occurance of the sub string in a string"
			item.detail = "INDEX(expression,substring)\r\nINDEX(expression,substring,occurance)"
			break;
		case 26:
			item.documentation = "Return the attribute marker CHAR(254)"
			item.detail = "@AM"
			break;
		case 27:
			item.documentation = "Return the value marker CHAR(253)"
			item.detail = "@VM"
			break;
		case 28:
			item.documentation = "Return the sub value marker CHAR(252)"
			item.detail = "@SVM"
			break;
		case 29:
			item.documentation = "Return the text marker CHAR(250)"
			item.detail = "@TM"
			break;
		case 30:
			item.documentation = "The LOOP statement begins a code block for looping. The loop is exited when either the WHILE/UNTIL is satisfield or the EXIT clause is executed"
			item.detail = "LOOP\r\n\r\n{UNTIL/WHILE condition}\r\n\r\nREPEAT"
			break;
		case 31:
			item.documentation = "The END CASE statement terminates a CASE block. There should be a corrosponding END CASE for each BEGIN CASE."
			item.detail = "END CASE"
			break;
		case 32:
			item.documentation = "The END statement terminates a THEN/ELSE block."
			item.detail = "END"
			break;
		case 33:
			item.documentation = "The GOSUB statements transfers execution to the internal subroutine named. Exection is continued with the first statement after the GOSUB when a RETURN is encounterd"
			item.detail = "GOSUB label{:}"
			break;
		case 34:
			item.documentation = "The END  statement terminates a THEN/ELSE block."
			item.detail = "END"
			break;
		case 35:
			item.documentation = "The UPCASE function converts an expression to all upper case characters."
			item.detail = "UPCASE(expression)"
			break;
		case 36:
			item.documentation = "The DOWNCASE function converts an expression to all upper case characters."
			item.detail = "DOWNCASE(expression)"
			break;
		case 37:
			item.documentation = "The DQUOTE function return a string enclosed in double quotes."
			item.detail = "DQUOTE(expression)"
			break;
		case 38:
			item.documentation = "The SQUOTE function return a string enclosed in single quotes."
			item.detail = "SQUOTE(expression)"
			break;
		case 39:
			item.documentation = "The PRINT statement sends out to a print channel. If no printer is on, the output goes to the terminal."
			item.detail = "PRINT expression\r\nPRINT ON channel expression"
			break;
		case 40:
			item.documentation = "The PRINTER ON statement turns on the printing on to the printer."
			item.detail = "PRINTER ON"
			break;
		case 41:
			item.documentation = "The PRINTER OFF statement turns off printing to the printer. All subsequent PRINT statements will print to the terminal."
			item.detail = "PRINTER OFF"
			break;
		case 42:
			item.documentation = "The PRINTER CLOSE statement closes the print channel."
			item.detail = "PRINTER CLOSE"
			break;
		case 43:
			item.documentation = "The OCONV() function converts the value of expression to its external representation according to the conversion codes in conversioncode."
			item.detail = "OCONV(expression,conversioncode)"
			break;
		case 44:
			item.documentation = "The OCONV() function converts the value of expression to its internal representation according to the conversion codes in conversioncode."
			item.detail = "ICONV(expression,conversioncode)"
			break;
		case 45:
			item.documentation = "The INT function returns the integer portion of a number with no decimal points."
			item.detail = "INT(expression)"
			break;
		case 46:
			item.documentation = "The $INCLUDE directive inserts the program specified into the current source code. If the optional filename is specified the code is read from the file."
			item.detail = "$INCLUDE programname\r\n$INCLUDE filename programname"
			break;
		case 47:
			item.documentation = "The NEXT statement terminates a FOR loop. Control is passed back to the FOR statement and the variable is incremented."
			item.detail = "NEXT variable"
			break;
		case 48:
			item.documentation = "The Continue statement returns program execution to the top of the FOR/LOOP loop."
			item.detail = "CONTINUE"
			break;
		case 49:
			item.documentation = "The RETURN statement returns program execution to the following statement after a GOSUB. It also returns from a BASIC subroutine if no GOSUB is active."
			item.detail = "RETURN"
			break;
		case 50:
			item.documentation = "The EXIT statement exits a LOOP or FOR loop."
			item.detail = "EXIT"
			break;
		case 51:
			item.documentation = "The CHANGE function replaces one string with another in an expression."
			item.detail = "CHANGE(expression,string to replace,string to replace with)"
			break;
		case 52:
			item.documentation = "The LOWER function lowers each marker by 1. AM > VM, VM > SVM etc"
			item.detail = "LOWER(expression)"
			break;
		case 53:
			item.documentation = "The RAISE function raises each marker by 1. SVM > VM, VM > AM etc."
			item.detail = "RAISE(expression)"
			break;
		case 54:
			item.documentation = "The DELETE functions removes an attrribute, value or subvalue from a dynamic array."
			item.detail = "DELETE(variable,am)\r\nDELETE(variable,am,vm)\r\nDELETE(variable,am,vm,svm)"
			break;
		case 55:
			item.documentation = "The CONVERT statement converts a series of characters to alternate characters in a dynamic array."
			item.detail = "CONVERT characters TO newcharacters IN variable"
			break;
		case 56:
			item.documentation = "The BEGIN TRANSACTION statement indicates the start of a transaction. All writes are batched together and are only commited when the COMMIT statement is execute."
			item.detail = "BEGIN TRANSACTION"
			break;
		case 57:
			item.documentation = "The END TRANSACTION statement indicates the end of a transaction. After a COMMIT or ROLLBACK, execution continues at the statements following the END TRANSACTION."
			item.detail = "END TRANSACTION"
			break;
		case 58:
			item.documentation = "The COMMIT statement commits all writes in the transaction to the disk and continues executing at the statement following the END TRANSCTION."
			item.detail = "COMMIT"
			break;
		case 59:
			item.documentation = "The ROLLBACK statement discards all writes in the transaction and continues executing at the statement following the END TRANSCTION."
			item.detail = "ROLLBACK"
			break;
		case 60:
			item.documentation = "The READu statement reads a record from a file with supplied key and attempts to lock the record. If the record is already locked the statements following the LOCKED clause are executed. If no LOCKED clause is present, execution stops and the record is released. If the key exists the THEN statements are executed otherwise the ELSE statements are executed. the ON ERROR clause is executed if am error occurs during the READ process."
			item.detail = "READU record FROM filevariable, key {LOCKED} {ON ERROR} THEN/ELSE"
			break;
		case 61:
			item.documentation = "The WRITEU statements writes the record to a file using the key. If the record was previously locked, the lock is not removed"
			item.detail = "WRITEU record ON filevariable , key"
			break;
		case 62:
			item.documentation = "The PROGRAM statement defines this code as a program with no arguments. If must be the first statement in your code"
			item.detail = "PROGRAM"
		case 63:
			item.documentation = "The SUBROUTINE statement defines this code as a subroutine with optional arguments. Subroutines are called with the BASIC CALL statement.If must be the first statement in your code"
			item.detail = "SUBROUTINE"
		case 64:
			item.documentation = "The END ELSE terminates he THEN portion and begin the ELSE portion of a code block"
			item.detail = "END ELSE"
		case 65:
			item.documentation = "The READLIST statement reads all the remaining keys from the list number or list variable into a dynamic array. If keys are present in the list the THEN clause is executed else the ELSE clause is exected"
			item.detail = "READLIST variable FROM {listnumber|listvariable} THEN/ELSE"
		case 66:
			item.documentation = "The UNTIL statement terminates a a FOR or LOOP loop when the specified expression is true. The optional DO is required in a LOOP"
			item.detail = "UNTIL expr {DO}"
		case 67:
			item.documentation = "The WHILE statement terminates a a FOR or LOOP loop when the specified expression is false. The optional DO is required in a LOOP"
			item.detail = "WHILE expr {DO}"
		case 68:
			item.documentation = "The GOTO statements transfer program execution to the label specified after the GOTO statement"
			item.detail = "GOTO label\r\nGO label\r\nGO TO label"
		case 69:
			item.documentation = "The DELETE Statement deletes a record from a file using the supplied key"
			item.detail = "DELETE filevariable,key"

		case 70:
			item.documentation = "The UNASSIGNED function return True(1) when a variables has previously been assigned a value and False(0) when it has not bee assigned a value"
			item.detail = "UNASSIGNED(variable)"
		case 71:
			item.documentation = "The RELEASE statement release a record lock that was previously set with a READU. If only the filevariable argument is specified, all locks for that file are release. If no arguments are specified, all locks set by the user are released."
			item.detail = "RELEASE\r\nRELEASE filevariable\r\nRELEASE filevariable, key"
		case 72:
			item.documentation = "The STOP statement terminates the current program and return to the calling program or TCL."
			item.detail = "STOP"
		case 73:
			item.documentation = "The EQU/EQUATE statement replaces all occurances of the equated definition with it's equivalant Value in your program."
			item.detail = "EQU definition TO value"

		case 74:
			item.documentation = "The EQU/EQUATE statement replaces all occurances of the equated definition with it's equivalant Value in your program."
			item.detail = "EQU definition TO value"



	}

	return item;
});

// Listen on the connection
connection.listen();

connection.onReferences((params => {
	var locations: Location[] = [];
	let uri = params.textDocument.uri;
	let doc = documents.get(uri);
	let xpos = params.position.character;
	let ypos = params.position.line;
	let lines = currentDocument.split(/\r?\n/g);
	let line = lines[ypos]
	// scan back to the begining of the word
	while (xpos > 0) {
		let char = line.substr(xpos, 1)
		if (" +-*/><".indexOf(char) != -1) { break; }
		xpos--
	}
	let labelStart = xpos;
	xpos = labelStart + 1;
	let start = xpos
	while (xpos < line.length) {
		if (line.substr(xpos, 1) == " ") { break }
		if (line.substr(xpos, 1) == "(") { break }
		if (line.substr(xpos, 1) == "<") { break }
		if (line.substr(xpos, 1) == "[") { break }
		if (line.substr(xpos, 1) == "/") { break }
		xpos++
	}
	let word = line.substring(start, xpos)
	let startPos = 0;
	while (doc.getText().indexOf(word, startPos) != -1) {
		startPos = doc.getText().indexOf(word, startPos);
		let loc = Location.create(uri, convertRange(doc, { start: startPos, length: word.length }));
		locations.push(loc);
		startPos++;

	}
	return locations;
}));

function convertRange(
	document: TextDocument,
	span: { start: number; length: number }
): Range {
	const startPosition = document.positionAt(span.start);
	const endPosition = document.positionAt(span.start + span.length);
	return Range.create(startPosition, endPosition);
}
connection.onDocumentSymbol(params => {

	let uri = params.textDocument.uri;
	let doc = documents.get(uri);
	let lines = doc.getText().split(/\r?\n/g);
	let rInclude = new RegExp("^(include |\\$include |\\s+include |\\s+\\$include)", "i");
	let rGoto = new RegExp("(call )","i")
	

	let ans: SymbolInformation[] = [];

	for (let i = 0; i < LabelList.length; i++) {
		let lr: Range = Range.create(LabelList[i].LineNumber, 0, LabelList[i].LineNumber, 9999);
		let l: SymbolInformation = SymbolInformation.create(LabelList[i].LabelName, SymbolKind.Method, lr, params.textDocument.uri, "Internal Subroutines")
		ans.push(l);
	}
	for (let i = 0; i < lines.length; i++) {
		let line = lines[i];
		rGoto.lastIndex = 0;
		if (rGoto.test(line.trim()) === true)
		{
			let words = line.trim().split(' ');
			for (let j = 0 ; j < words.length;j++)
			{
				if (words[j].toLowerCase()=== "call")
				{
					let items = words[j+1].split('(');
					let li: Range = Range.create(i, 0, i, 9999);
					let l: SymbolInformation = SymbolInformation.create(items[0], SymbolKind.Field, li)
					ans.push(l);

				}
			}

		}
		if (rInclude.test(line.trim()) === true)
		{
			let words = line.trim().split(' ');
			let li: Range = Range.create(i, 0, i, 9999);
			let includeName = words[1];
			if (words.length > 2) { includeName += ","+words[2]}
			let l: SymbolInformation = SymbolInformation.create(includeName, SymbolKind.File, li)
		    ans.push(l);
		}
	}

	return ans;

})
connection.onDefinition((params => {
	let x = params.textDocument.uri
	let xpos = params.position.character
	let ypos = params.position.line
	let lines = currentDocument.split(/\r?\n/g);
	let line = lines[ypos]

	// scan back to the begining of the word
	while (xpos > 0) {
		let char = line.substr(xpos, 1)
		if (char == " ") { break }
		xpos--
	}
	let labelStart = xpos;
	xpos--
	// scan back to see if the previous word is a CALL
	while (xpos > 0) {
		let char = line.substr(xpos, 1)
		if (char == " ") { break }
		xpos--
	}
	if (xpos === 0) { xpos = -1 } // word is at begining of line
	let previousWord = line.substr(xpos + 1, labelStart - xpos - 1);
	let previousStart = xpos;
	xpos--;
	// could be using the format include nb.bp common so we need to check another word back
	while (xpos > 0) {
		let char = line.substr(xpos, 1)
		if (char == " ") { break }
		xpos--
	}
	if (xpos === 0) { xpos = -1 } // word is at begining of line
	let thirdWord = line.substr(xpos + 1, previousStart - xpos - 1);
	// scan forward to end of word

	xpos = labelStart + 1;
	let start = xpos
	while (xpos < line.length) {
		if (line.substr(xpos, 1) == " ") { break }
		if (line.substr(xpos, 1) == "(") { break }
		xpos++
	}
	let definition = line.substring(start, xpos)
	if (thirdWord.toLocaleLowerCase().endsWith("include")) {
		let parts = params.textDocument.uri.split("/");
		parts[parts.length - 1] = definition
		parts[parts.length - 2] = previousWord
		x = parts.join("/");
		let newProgram = Location.create(x, {

			start: { line: 0, character: 0 },
			end: { line: 0, character: line.length }
		});
		return newProgram;

	}
	// if we have a call, try and load program
	if (previousWord.toLocaleLowerCase() === "call" || previousWord.toLocaleLowerCase().endsWith("include") || previousWord.toLocaleLowerCase() === "chain") {
		let parts = params.textDocument.uri.split("/");
		parts[parts.length - 1] = definition
		x = parts.join("/");
		let newProgram = Location.create(x, {

			start: { line: 0, character: 0 },
			end: { line: 0, character: line.length }
		});
		return newProgram;

	}
	//let rLabel = new RegExp("(^[0-9]+\\s)|(^[0-9]+:\\s)|(^[\\w\\.]+:)", "i");
	let rLabel = new RegExp("(^[0-9]+\\b)|(^[0-9]+)|(^[0-9]+:\\s)|(^[\\w\\.]+:(?!\\=))","i")
	for (var i = 0; i < lines.length; i++) {
		line = lines[i]
		if (rLabel.test(line.trim()) == true) {
			let label = rLabel.exec(line.trim())[0].replace(":", "");
			if (label == definition) {
				return Location.create(x, {
					start: { line: i, character: 0 },
					end: { line: i, character: label.length }

				})

			}

		}
	}



	return Location.create(x, {
		start: { line: params.position.line, character: params.position.character },
		end: { line: params.position.line, character: params.position.character }
	});
}));
/*
connection.onDidOpenTextDocument((params) => {
	// A text document got opened in VSCode.
	// params.uri uniquely identifies the document. For documents store on disk this is a file URI.
	// params.text the initial full content of the document.
	currentDocument = params.textDocument.text;
	connection.console.log(`${params.textDocument.uri} opened.`);
});
connection.onDidChangeTextDocument((params) => {
	// The content of a text document did change in VSCode.
	// params.uri uniquely identifies the document.
	// params.contentChanges describe the content changes to the document.
	currentDocument = params.contentChanges[0].text

	connection.console.log(`${params.textDocument.uri} changed: ${JSON.stringify(params.contentChanges)}`);
});
connection.onDidCloseTextDocument((params) => {
	// A text document got closed in VSCode.
	// params.uri uniquely identifies the document.
	connection.console.log(`${params.textDocument.uri} closed.`);
});*/


