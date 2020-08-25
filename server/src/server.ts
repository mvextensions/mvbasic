/* --------------------------------------------------------------------------------------------
 * Copyright (c) MV Extensions. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
"use strict";

import {
  IPCMessageReader,
  IPCMessageWriter,
  createConnection,
  IConnection,
  TextDocuments,
  TextDocumentSyncKind,
  Diagnostic,
  DiagnosticSeverity,
  InitializeResult,
  TextDocumentPositionParams,
  CompletionItem,
  CompletionItemKind,
  Location,
  Range,
  SymbolInformation,
  SymbolKind,
  Hover,
  MarkupContent,
  MarkupKind
} from "vscode-languageserver";

import {
  TextDocument
} from 'vscode-languageserver-textdocument';

import fs = require("fs");
import * as path from "path";

/* Initialize Variables */

// Create a connection for the server. The connection uses Node's IPC as a transport
let connection: IConnection = createConnection(
  new IPCMessageReader(process),
  new IPCMessageWriter(process)
);

let useCamelcase = true;
let ignoreGotoScope = false;

// The settings interface describe the server relevant settings part
interface Settings {
  MVBasic: ExampleSettings;
}

// These are the example settings we defined in the client's package.json file
interface ExampleSettings {
  maxNumberOfProblems: number;
  useCamelCase: boolean;
  ignoreGotoScope: boolean;
  customWords: string;
  customWordPath: string;
  customFunctions: string;
  customFunctionPath: string;
  languageType: string;
  trace: any; // expect trace.server is string enum 'off', 'messages', 'verbose'
}

// Describes a line inside a document
interface DocumentLine {
  lineNumber: number;
  lineOfCode: string;
}

let maxNumberOfProblems: number;
let customWordList: string;
let customWordPath: string;
let customFunctionPath: string;
let languageType: string;
let logLevel: number;
let Intellisense: CompletionItem[] = [];

// Label class represents instances of parsed labels in code, i.e. "LABEL.NAME:"
class Label {
  LabelName: string;
  LineNumber: number;
  Level: number;
  Referenced: boolean;
  constructor(
    LabelName: string,
    LineNumber: number,
    Level: number,
    Referenced: boolean
  ) {
    this.LabelName = LabelName;
    this.Level = Level;
    this.LineNumber = LineNumber;
    this.Referenced = Referenced;
  }
}

var LabelList: Label[] = [];

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// A document was opened
documents.onDidOpen(event => {
  if (logLevel) {
    connection.console.log(
      `[Server(${process.pid})] Document opened: ${event.document.uri}`
    );
  }
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
  validateTextDocument(change.document);
});

/* Functions */

function convertRange(
  document: TextDocument,
  span: { start: number; length: number }
): Range {
  const startPosition = document.positionAt(span.start);
  const endPosition = document.positionAt(span.start + span.length);
  return Range.create(startPosition, endPosition);
}

function getWord(line: string, wordCount: number): string {
  if (line.length == 0 || wordCount < 1) {
    return line;
  }
  let rWhitespace = new RegExp("\\s{2,}"); // 2 or more whitespace chars
  line = line.replace(rWhitespace, " ").trim();
  let words = line.split(" ");

  if (wordCount > words.length) {
    return "";
  }

  return words[wordCount - 1];
}

function loadIntelliSense() {
  // Load new IntelliSense
  Intellisense = [];
  var filePath = __dirname;

  // Use the Language Type setting to drive the language file used for Intellisense
  // MW: Ugly but let's try it for now
  switch (languageType) {
    case "jBASE":
      filePath =
        filePath +
        path.join("../", "../", "../", "Syntaxes", "jBASELanguage.json");
      break;
    case "OpenQM":
      filePath =
        filePath +
        path.join("../", "../", "../", "Syntaxes", "QMLanguage.json");
      break;
    case "UniVerse":
      filePath =
        filePath +
        path.join("../", "../", "../", "Syntaxes", "UniVerseLanguage.json");
      break;
    case "MVON":
    default:
      filePath =
        filePath +
        path.join("../", "../", "../", "Syntaxes", "MvLanguage.json");
      break;
  }
  filePath = path.normalize(filePath);

  var languageDefinition = fs.readFileSync(filePath, "utf8");
  var languageDefinitionList = JSON.parse(languageDefinition);
  var keywords = languageDefinitionList.Language.Keywords;

  for (let i = 0; i < keywords.length; i++) {
    if (useCamelcase === true) {
      Intellisense.push({
        label: keywords[i].key,
        kind: keywords[i].icon,
        data: keywords[i].index,
        detail: keywords[i].detail,
        documentation: keywords[i].documentation
      });
    } else {
      Intellisense.push({
        label: keywords[i].key.toUpperCase(),
        kind: keywords[i].icon,
        data: keywords[i].index,
        detail: keywords[i].detail,
        documentation: keywords[i].documentation
      });
    }
  }

  // Load CustomWord definition
  if (customWordPath !== "") {
    var contents = fs.readFileSync(customWordPath, "utf8");
    customWordList = "(";
    var lines = contents.replace("\r", "").split("\n");
    for (let i = 0; i < lines.length; i++) {
      let parts = lines[i].split(":");
      customWordList += parts[0].replace('"', "").replace('"', "") + "|";
    }
    customWordList = customWordList.substr(0, customWordList.length - 1) + ")";

    var items = customWordList.split("|");
    for (let i = 0; i < items.length; i++) {
      Intellisense.push({
        label: items[i],
        kind: CompletionItemKind.Interface,
        data: 999
      });
    }
  }
  
  // Load CustomFunction definition
  if (customFunctionPath !== "") {
    var functionDefinition = fs.readFileSync(customFunctionPath, "utf8");
    var customFunctionList = JSON.parse(functionDefinition);
    var functions = customFunctionList.Language.functions;
    for (let i = 0; i < functions.length; i++) {
      Intellisense.push({
        label: functions[i].key,
        insertText: functions[i].insertText,
        kind: functions[i].kind,
        data: functions[i].index,
        detail: functions[i].detail,
        documentation: functions[i].documentation
      });
    }
  }
  
  if (logLevel) {
    connection.console.log(
      `[Server(${process.pid})] Language definition loaded for ${languageType}`
    );
  }
  return Intellisense;
}

function validateTextDocument(textDocument: TextDocument): void {
  let diagnostics: Diagnostic[] = [];
  let originalLines = textDocument.getText().split(/\r?\n/g);
  let lines: DocumentLine[] = [];
  originalLines.forEach((lineOfCode, index) => lines.push({ lineNumber: index, lineOfCode }));
  let problems = 0;
  LabelList.length = 0;

  let rBlockStart = new RegExp("(^| )(begin case$|(if|readnext|open|read|readv|readu|readt|locate|openseq|matread|create|readlist|openpath|find|findstr)\\s+?)", "i");
  let rBlockAlways = new RegExp("(^| )(for |loop( |$))", "i");
  let rBlockContinue = new RegExp(" (then|else|case|on error|locked)$", "i");
  let rBlockEnd = new RegExp("(^| )(end|end case|next|next\\s+.+|repeat)$", "i");
  let rStartFor = new RegExp("(^| )for\\s+[\\w.]+\\s*=", "i");
  let rEndFor = new RegExp("(^| )next($|\\s+.+$)", "i");
  let rStartLoop = new RegExp("(^| )loop\\s*?", "i");
  let rEndLoop = new RegExp("(^| )repeat\\s*$", "i");
  let rStartCase = new RegExp("(^| )begin case$", "i");
  let rEndCase = new RegExp("^\\s*end case$", "i");
  let rElseEnd = new RegExp("^\\s*end else$", "i");
  let rLabel = new RegExp("^\\s*([\\w\\.]+:(?!=)|[0-9\\.]+)", "i");
  let rComment = new RegExp("^\\s*(\\*|!|REM\\s+?).*", "i"); // Start-of-line 0-or-more whitespace {* ! REM<space>} Anything
  let tComment = new RegExp(";\\s*(\\*|!|REM\\s+?).*", "i"); // (something); {0-or-more whitespace} {* ! REM<space>} Anything
  let lComment = new RegExp("^\\s*([\\w\\.]+:(?!=)|[0-9\\.]+)(\\s*(\\*|!|REM\\s+?).*)", "i");
  let qStrings = new RegExp("'.*?'|\".*?\"|\\\\.*?\\\\", "g");
  let rParenthesis = new RegExp("\\(.*\\)", "g");
  let noCase = 0;
  let noLoop = 0;
  let noEndLoop = 0;
  let noEndCase = 0;

  // first build a list of labels in the program and indentation levels, strip comments, break up ; delimited lines
  let Level = 0;
  var RowLevel: number[] = [lines.length];
  let forNext = []    // FOR statements list
  let forNextErr = [] // FOR NEXT errors list

  for (var i = 0; i < lines.length && problems < maxNumberOfProblems; i++) {
    let line = lines[i];

    // Begin cleanup lines[] array -- Remove and replace irrelevant code.

    // replace comment line with blank line
    line.lineOfCode = line.lineOfCode.replace(rComment, "");

    // remove comments after label (no semi-colon)
    if (lComment.test(line.lineOfCode)) {
      let comment = lComment.exec(line.lineOfCode);
      line.lineOfCode = comment![1];
    }

    // remove trailing comments with a semi-colon
    line.lineOfCode = line.lineOfCode.replace(tComment, "");

    // replace contents of parenthesis with spaces, maintaining original
    // character positions for intellisense error highlighting.
    let v = rParenthesis.exec(line.lineOfCode);
    if (v !== null) {
      let value = "(" + " ".repeat(v[0].length - 2) + ")";
      line.lineOfCode = line.lineOfCode.replace(rParenthesis, value);
    }

    // replace contents of quoted strings with spaces, maintaining original
    // character positions for intellisense error highlighting.
    v = qStrings.exec(line.lineOfCode);
    if (v !== null) {
      let value = "'" + " ".repeat(v[0].length - 2) + "'";
      line.lineOfCode = line.lineOfCode.replace(qStrings, value);
    }

    // Trim() trailing spaces
    line.lineOfCode = line.lineOfCode.trimRight();

    // Save cleaned line
    lines[i] = line;

    // End cleanup of lines[] array

    /* Before we do anything else, split line into statements on semicolon
       Should split lines like:
         FOR F=1 TO 20;CRT "NEW=":F;NEXT F ;* COMMENT
       Should not split lines such as:
         LEASE.TYPE=OCONV(ID,"TLS.MASTER,LS.BILLING;X;38;38")
         locate(acontinent,continents,1;position;’al’) then crt acontinent:’ is already there’
    */
    if (line.lineOfCode.indexOf(";") > 0) {
      let a = line.lineOfCode.split(";");
      // Replace line i with the first statement
      lines[i] = { lineNumber: line.lineNumber, lineOfCode: a[0].trimRight() };
      line = lines[i];
      // Insert new lines for each subsequent statement, but keep line.lineNumber the same
      for (let j = 1; j < a.length; j++) {
        lines.splice(i + j, 0, { lineNumber: line.lineNumber, lineOfCode: a[j].trimRight() });
      }
    }

    // check opening and closing block FOR/NEXT - Track matches
    // and build errors list (forNextErr[]).
    let arrFor = rStartFor.exec(line.lineOfCode)
    if (arrFor !== null) {
      let sFor = arrFor[0].split("=");
      let forvar = getWord(sFor[0], 2);
      forNext.push({ forVar: forvar, forLine: i });
    }
    let arrNext = rEndFor.exec(line.lineOfCode)
    if (arrNext !== null) {
      let nextvar = getWord(arrNext[0], 2);
      let pos = forNext.length - 1;
      if (pos < 0) {
        forNextErr.push({ errMsg: "Missing FOR statement - NEXT " + nextvar, errLine: i });
      } else {
        let o = forNext[pos];
        if (nextvar != "" && o.forVar !== nextvar) {
          forNextErr.push({ errMsg: "Missing NEXT statement - FOR " + o.forVar, errLine: o.forLine });
          forNextErr.push({ errMsg: "Missing FOR statement - NEXT " + nextvar, errLine: i });
        }
        forNext.pop();
      }
    }

    // Check for CASE/LOOP
    if (rStartCase.test(line.lineOfCode)) {
      noCase++;
    }
    if (rEndCase.test(line.lineOfCode)) {
      noEndCase++;
    }
    if (rStartLoop.test(line.lineOfCode)) {
      noLoop++;
    }
    if (rEndLoop.test(line.lineOfCode)) {
      noEndLoop++;
    }
    // check block statements
    if (rBlockStart.test(line.lineOfCode)) {
      Level++;
      if (rBlockContinue.test(line.lineOfCode) === false) {
        // single line statement
        Level--;
      }
    }

    if (rBlockAlways.test(line.lineOfCode)) {
      Level++;
    }
    if (rBlockEnd.test(line.lineOfCode)) {
      Level--;
    }
    if (rElseEnd.test(line.lineOfCode)) {
      // decrement 1 to cater for end else stements
      Level--;
    }
    // 10  10:  start: labels
    if (rLabel.test(line.lineOfCode)) {
      let label = "";
      if (line !== null) {
        let labels = rLabel.exec(line.lineOfCode.trim());
        if (labels !== null) {
          label = labels[0].trim().replace(":", "");
        }
      }
      LabelList.push(new Label(label, line.lineNumber, Level, false));
    }
    RowLevel[i] = Level;
  }

  // Missing NEXT errors. More FOR statements than NEXT values matched.
  forNext.forEach(function (o) {
    forNextErr.push({ errMsg: "Missing NEXT statement - FOR " + o.forVar, errLine: o.forLine });
  });

  forNextErr.forEach(function (o) {
    let errorMsg = o.errMsg;
    let line = lines[o.errLine];
    let diagnosic: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      range: {
        start: { line: line.lineNumber, character: 0 },
        end: { line: line.lineNumber, character: line.lineOfCode.length }
      },
      message: errorMsg,
      source: "MV Basic"
    }
    diagnostics.push(diagnosic);
  });

  // Missing END CASE statement
  if (noCase != noEndCase) {
    // find the innermost for
    for (var i = 0; i < lines.length && problems < maxNumberOfProblems; i++) {
      let line = lines[i];
      if (rStartCase.test(line.lineOfCode)) {
        noCase--;
      }
      if (noCase == 0) {
        let diagnosic: Diagnostic = {
          severity: DiagnosticSeverity.Error,
          range: {
            start: { line: line.lineNumber, character: 0 },
            end: { line: line.lineNumber, character: line.lineOfCode.length }
          },
          message: `Missing END CASE statement`,
          source: "MV Basic"
        };
        diagnostics.push(diagnosic);
      }
    }
  }

  // Missing REPEAT statement
  if (noLoop != noEndLoop) {
    // find the innermost for
    for (var i = 0; i < lines.length && problems < maxNumberOfProblems; i++) {
      let line = lines[i];
      if (rStartLoop.test(line.lineOfCode)) {
        noLoop--;
      }
      if (noLoop == 0) {
        let diagnosic: Diagnostic = {
          severity: DiagnosticSeverity.Error,
          range: {
            start: { line: line.lineNumber, character: 0 },
            end: { line: line.lineNumber, character: line.lineOfCode.length }
          },
          message: `Missing REPEAT statement`,
          source: "MV Basic"
        };
        diagnostics.push(diagnosic);
      }
    }
  }

  // Missing END, END CASE or REPEAT statements
  // if Level is != 0, we have mis matched code blocks
  if (Level > 0) {
    let lastLine = lines[lines.length - 1];
    let diagnosic: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      range: {
        start: { line: lastLine.lineNumber, character: 0 },
        end: { line: lastLine.lineNumber, character: lastLine.lineOfCode.length }
      },
      message: `Missing END, END CASE or REPEAT statements`,
      source: "MV Basic"
    };
    diagnostics.push(diagnosic);
  }

  // Missing GO, GO TO, GOTO, GOSUB
  // regex to check for goto/gosub in a line
  let rGoto = new RegExp("(^| )(go to|goto|go|gosub)(\\s+.*)", "i");

  for (var i = 0; i < lines.length && problems < maxNumberOfProblems; i++) {
    let line = lines[i];
    let labelName = "";
    // check any gosubs or goto's to ensure label is present
    let text = line.lineOfCode;
    text.split(rGoto)
    let arrLabels = rGoto.exec(text);
    if (arrLabels == null) { continue }
    text = arrLabels[3];
    let labels = text.split(",");

    for (let ndx = 0; ndx < labels.length; ndx++) {
      const item = labels[ndx];
      labelName = getWord(item, 1);
      if (labelName.toLocaleLowerCase() == "to") {
        labelName = getWord(item, 2);
      }

      let checkLabel = "";
      let labelMatch = LabelList.find(label => label.LabelName === labelName);
      if (labelMatch) {
        // set the referened flag
        labelMatch.Referenced = true;
        if (
          labelMatch.Level != RowLevel[i] &&
          labelMatch.Level > 1 &&
          ignoreGotoScope === false
        ) {
          // jumping into or out of a loop
          let index = line.lineOfCode.indexOf(labelName);
          let diagnosic: Diagnostic = {
            severity: DiagnosticSeverity.Warning,
            range: {
              start: { line: line.lineNumber, character: index },
              end: { line: line.lineNumber, character: index + labelName.length }
            },
            message: `${labelName} goes out of scope. Invalid GOTO or GOSUB`,
            source: "MV Basic"
          };
          diagnostics.push(diagnosic);
        }
      } else {
        let index = line.lineOfCode.indexOf(labelName);
        let diagnosic: Diagnostic = {
          severity: DiagnosticSeverity.Error,
          range: {
            start: { line: line.lineNumber, character: index },
            end: { line: line.lineNumber, character: index + labelName.length }
          },
          message: `Label ${labelName} not found! - Invalid GOTO or GOSUB`,
          source: "MV Basic"
        };
        diagnostics.push(diagnosic);

        if (logLevel) {
          connection.console.log(
            `[Server(${process.pid})] CheckLabel: ${checkLabel} + MatchedLabel: ${labelMatch}`
          );
        }
      }
    }
  }

  // Missing Labels
  LabelList.forEach(function (label) {
    if (label.Referenced === false) {
      let diagnosic: Diagnostic = {
        severity: DiagnosticSeverity.Warning,
        range: {
          start: { line: label.LineNumber, character: 0 },
          end: { line: label.LineNumber, character: label.LabelName.length }
        },
        message: `Label ${label.LabelName} is not referenced`,
        source: "MV Basic"
      };
      diagnostics.push(diagnosic);
    }
  });
  // Send the computed diagnostics to VSCode.
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

/* Connection Events */
// Listen on the connection
connection.listen();

// After the server has started the client sends an initialize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilities.
let shouldSendDiagnosticRelatedInformation: boolean | undefined = false;
if (shouldSendDiagnosticRelatedInformation) { null }
connection.onInitialize(
  (_params): InitializeResult => {
    shouldSendDiagnosticRelatedInformation =
      _params.capabilities &&
      _params.capabilities.textDocument &&
      _params.capabilities.textDocument.publishDiagnostics &&
      _params.capabilities.textDocument.publishDiagnostics.relatedInformation;
    if (logLevel) {
      connection.console.log(
        `[Server(${process.pid})] Started and initialize received`
      );
    }
    return {
      capabilities: {
        // Tell the client that the server works in FULL text document sync mode
        textDocumentSync: TextDocumentSyncKind.Full,
        // Tell the client that the server support code complete
        completionProvider: {
          resolveProvider: true
        },
        definitionProvider: true,
        referencesProvider: true,
        documentSymbolProvider: true,
        hoverProvider: true
      }
    };
  }
);

// The settings have changed. Is send on server activation as well.
connection.onNotification("languagePath", (path: string) => {
  path = path + "";
});

connection.onDidChangeConfiguration(change => {
  let settings = <Settings>change.settings;
  maxNumberOfProblems = settings.MVBasic.maxNumberOfProblems || 100;
  useCamelcase = settings.MVBasic.useCamelCase;
  ignoreGotoScope = settings.MVBasic.ignoreGotoScope;
  customWordList = settings.MVBasic.customWords;
  customWordPath = settings.MVBasic.customWordPath;
  languageType = settings.MVBasic.languageType;
  const _logLevel = <string>(settings.MVBasic.trace && settings.MVBasic.trace.server) || 'off';
  switch (_logLevel) {
    case 'messages': logLevel = 1; break;
    case 'verbose': logLevel = 2; break;
    default: logLevel = 0;
  }
  loadIntelliSense();

  // Revalidate any open text documents
  documents.all().forEach(validateTextDocument);
});

connection.onDidChangeWatchedFiles(_change => {
  // Monitored files have change in VSCode
  if (logLevel) {
    connection.console.log("We received an file change event");
  }
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
  (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    // The pass parameter contains the position of the text document in
    // which code complete got requested. For the example we ignore this
    // info and always provide the same completion items.
    // if the previous word is GOTO GOSUB or GO TO make a list of labels available
    let lineNo = _textDocumentPosition.position.line;
    let charCount = _textDocumentPosition.position.character;
    let document = documents.get(_textDocumentPosition.textDocument.uri);
    if (document) {
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
          statement = line.substr(charCount + 1, wordStart - charCount);

          if (
            statement.toLocaleLowerCase() === "gosub" ||
            statement.toLocaleLowerCase() === "go" ||
            statement.toLocaleLowerCase() === "go to" ||
            statement.toLocaleLowerCase() === "goto"
          ) {
            for (let i = 0; i < LabelList.length; i++) {
              Intellisense.push({
                label: LabelList[i].LabelName,
                kind: CompletionItemKind.Reference,
                data: 999
              });
            }
          }
        }
      }
    }

    return Intellisense;
  }
);

// This handler resolve additional information for the item selected in the completion list.
connection.onCompletionResolve(
  (item: CompletionItem): CompletionItem => {
    if (Intellisense != undefined) {
      for (let i = 0; i < Intellisense.length; i++) {
        if (Intellisense[i].data == item.data) {
          item.documentation = Intellisense[i].documentation;
          item.detail = Intellisense[i].detail;
        }
      }
      return item;
    }
    return item;
  }
);

connection.onReferences(params => {
  var locations: Location[] = [];
  let uri = params.textDocument.uri;
  let xpos = params.position.character;
  let ypos = params.position.line;
  let doc = documents.get(uri);
  if (doc) {
    let lines = doc.getText().split(/\r?\n/g);
    let line = lines[ypos];
    // scan back to the begining of the word
    while (xpos > 0) {
      let char = line.substr(xpos, 1);
      if (" +-*/><".indexOf(char) != -1) {
        break;
      }
      xpos--;
    }
    let labelStart = xpos;
    xpos = labelStart + 1;
    let start = xpos;
    while (xpos < line.length) {
      if (line.substr(xpos, 1) == " ") {
        break;
      }
      if (line.substr(xpos, 1) == "(") {
        break;
      }
      if (line.substr(xpos, 1) == "<") {
        break;
      }
      if (line.substr(xpos, 1) == "[") {
        break;
      }
      if (line.substr(xpos, 1) == "/") {
        break;
      }
      xpos++;
    }
    let word = line.substring(start, xpos);
    let startPos = 0;
    while (doc.getText().indexOf(word, startPos) != -1) {
      startPos = doc.getText().indexOf(word, startPos);
      let loc = Location.create(
        uri,
        convertRange(doc, { start: startPos, length: word.length })
      );
      locations.push(loc);
      startPos++;
    }
  }
  return locations;
});

connection.onDocumentSymbol(params => {
  let ans: SymbolInformation[] = [];
  let uri = params.textDocument.uri;
  let doc = documents.get(uri);
  if (doc) {
    let lines = doc.getText().split(/\r?\n/g);
    let rInclude = new RegExp(
      "^(include |\\$include |\\s+include |\\s+\\$include)",
      "i"
    );
    let rGoto = /(?<![\p{Zs}\t]*(\*|!).*)(?<!\/\*(?:(?!\*\/)[\s\S\r])*?)\b(call )+(?=[^\"]*(\"[^\"]*\"[^\"]*)*$)\b/i;

    for (let i = 0; i < LabelList.length; i++) {
      let lr: Range = Range.create(
        LabelList[i].LineNumber,
        0,
        LabelList[i].LineNumber,
        9999
      );
      let l: SymbolInformation = SymbolInformation.create(
        LabelList[i].LabelName,
        SymbolKind.Method,
        lr,
        params.textDocument.uri,
        "Internal Subroutines"
      );
      ans.push(l);
    }
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      rGoto.lastIndex = 0;
      if (rGoto.test(line)) {
        let words = line.trim().split(" ");
        for (let j = 0; j < words.length; j++) {
          if (words[j].toLowerCase() === "call") {
            let items = words[j + 1].split("(");
            let li: Range = Range.create(i, 0, i, 9999);
            let l: SymbolInformation = SymbolInformation.create(
              items[0],
              SymbolKind.Field,
              li
            );
            ans.push(l);
          }
        }
      }
      if (rInclude.test(line)) {
        let words = line.trim().split(" ");
        let li: Range = Range.create(i, 0, i, 9999);
        let includeName = words[1];
        if (words.length > 2) {
          includeName += "," + words[2];
        }
        let l: SymbolInformation = SymbolInformation.create(
          includeName,
          SymbolKind.File,
          li
        );
        ans.push(l);
      }
    }

  }
  return ans;
});

connection.onDefinition(params => {
  let uri = params.textDocument.uri;
  let xpos = params.position.character;
  let ypos = params.position.line;
  let doc = documents.get(uri);
  if (doc) {
    let lines = doc.getText().split(/\r?\n/g);
    let line = lines[ypos];

    // scan back to the begining of the word
    while (xpos > 0) {
      let char = line.substr(xpos, 1);
      if (char == " ") {
        break;
      }
      xpos--;
    }
    let labelStart = xpos;
    xpos--;
    // scan back to see if the previous word is a CALL
    while (xpos > 0) {
      let char = line.substr(xpos, 1);
      if (char == " ") {
        break;
      }
      xpos--;
    }
    if (xpos === 0) {
      xpos = -1;
    } // word is at begining of line
    let previousWord = line.substr(xpos + 1, labelStart - xpos - 1);
    let previousStart = xpos;
    xpos--;
    // could be using the format include nb.bp common so we need to check another word back
    while (xpos > 0) {
      let char = line.substr(xpos, 1);
      if (char == " ") {
        break;
      }
      xpos--;
    }
    if (xpos === 0) {
      xpos = -1;
    } // word is at begining of line
    let thirdWord = line.substr(xpos + 1, previousStart - xpos - 1);
    // scan forward to end of word

    xpos = labelStart + 1;
    let start = xpos;
    while (xpos < line.length) {
      if (line.substr(xpos, 1) == " ") {
        break;
      }
      if (line.substr(xpos, 1) == "(") {
        break;
      }
      xpos++;
    }
    let definition = line.substring(start, xpos);
    if (thirdWord.toLocaleLowerCase().endsWith("include")) {
      let parts = params.textDocument.uri.split("/");
      parts[parts.length - 1] = definition;
      parts[parts.length - 2] = previousWord;
      uri = parts.join("/");
      let newProgram = Location.create(uri, {
        start: { line: 0, character: 0 },
        end: { line: 0, character: line.length }
      });
      return newProgram;
    }
    // if we have a call, try and load program
    if (
      previousWord.toLocaleLowerCase() === "call" ||
      previousWord.toLocaleLowerCase().endsWith("include") ||
      previousWord.toLocaleLowerCase() === "chain"
    ) {
      let parts = params.textDocument.uri.split("/");
      parts[parts.length - 1] = definition;
      uri = parts.join("/");
      let newProgram = Location.create(uri, {
        start: { line: 0, character: 0 },
        end: { line: 0, character: line.length }
      });
      return newProgram;
    }
    let rLabel = new RegExp(
      "(^[0-9]+\\b)|(^[0-9]+)|(^[0-9]+:\\s)|(^[\\w\\.]+:(?!\\=))",
      "i"
    );
    for (var i = 0; i < lines.length; i++) {
      line = lines[i];
      if (rLabel.test(line)) {
        let label = "";
        if (line !== null) {
          let labels = rLabel.exec(line.trim());
          if (labels !== null) {
            label = labels[0].trim().replace(":", "");
          }
        }
        if (label == definition) {
          return Location.create(uri, {
            start: { line: i, character: 0 },
            end: { line: i, character: label.length }
          });
        }
      }
    }
  }

  return Location.create(uri, {
    start: { line: params.position.line, character: params.position.character },
    end: { line: params.position.line, character: params.position.character }
  });
});

connection.onHover((params: TextDocumentPositionParams): Hover | undefined => {
  if (Intellisense === undefined) {
    return undefined;
  }
  let uri = params.textDocument.uri;
  let xpos = params.position.character;
  let ypos = params.position.line;
  let doc = documents.get(uri);
  if (doc) {
    let lines = doc.getText().split(/\r?\n/g);
    let line = lines[ypos];
    let start = xpos;
    while (start > 0) {
      let char = line.substr(--start, 1);
      if (char == " ") {
        start++;
        break;
      }
    }
    while (xpos < line.length) {
      if (line.substr(xpos, 1) == " ") {
        break;
      }
      if (line.substr(xpos, 1) == "(") {
        break;
      }
      xpos++;
    }
    let definition = line.substring(start, xpos);
    for (let i = 0; i < Intellisense.length; i++) {
      if (
        Intellisense[i].label == definition ||
        Intellisense[i].label.toUpperCase() == definition.toUpperCase()
      ) {
        let currentDetail = Intellisense[i].detail;
        let detail: String[] = [];
        if (currentDetail !== undefined) {
          detail = currentDetail.replace("\r", "").split("\n");
        }
        let currentDocumentation = Intellisense[i].documentation;
        let documentation: String[] = [];
        if (currentDocumentation !== undefined) {
          documentation = currentDocumentation
            .toString()
            .replace("\r", "")
            .split("\n");
        }

        let hoverContent: String[] = [];
        hoverContent.push("```");
        hoverContent.push(...detail);
        hoverContent.push("```");
        documentation.forEach(line => hoverContent.push(line + '\n'))

        let markdownContent: MarkupContent = {
          kind: MarkupKind.Markdown,
          value: hoverContent.join('\n')
        };
        return {
          contents: markdownContent
        };
      }
    }
  }
  return undefined;
});
