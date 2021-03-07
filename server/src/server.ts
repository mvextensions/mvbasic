/* --------------------------------------------------------------------------------------------
 * Copyright (c) MV Extensions. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
"use strict";

import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
  Location,
  Range,
  SymbolInformation,
  SymbolKind,
  Hover,
  MarkupContent,
  MarkupKind
} from "vscode-languageserver/node";

import {
  TextDocument
} from 'vscode-languageserver-textdocument';

import fs = require("fs");
import * as path from "path";

/* Initialize Variables */

// Create a connection for the server. The connection uses Node's IPC as a transport
let connection = createConnection(ProposedFeatures.all);

// The settings interface describe the server relevant settings part
interface Settings {
  MVBasic: ExampleSettings;
}

// These are the example settings we defined in the client's package.json file
interface ExampleSettings {
  maxNumberOfProblems: number;
  useCamelCase: boolean;
  userVariablesEnabled: boolean;
  ignoreGotoScope: boolean;
  customWords: string;
  customWordPath: string;
  customFunctionPath: string;
  languageType: string;
  trace: any; // expect trace.server is string enum 'off', 'messages', 'verbose'
}

// Describes a line inside a document
interface DocumentLine {
  lineNumber: number;
  lineOfCode: string;
}

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

//Find variables in lineOfCode
function getVariableName(lineOfCode: any) {
  let variableName: string[];
  variableName = [];
  let position;
  let wordArray;
  if (lineOfCode.length < 3) {return variableName;}
  if (lineOfCode.includes(" case ") || lineOfCode.includes(" CASE ")) {return variableName;}
  //get arguments from a CALL or SUBROUTINE as variables
  if (lineOfCode.includes("call ") || lineOfCode.includes("CALL ") || lineOfCode.includes("subroutine ") || lineOfCode.includes("SUBROUTINE ")) {
    let argumentString = lineOfCode.substring(lineOfCode.lastIndexOf("(") + 1, lineOfCode.lastIndexOf(")"));
    if (argumentString!=null) {
      position=lineOfCode.indexOf(",");
      if (position > 0) {
        var argumentList = argumentString.split("=");
        for (var i = 0; i < argumentList.length; i++) {
          variableName.push(argumentString[i].trim());
        }
        return variableName;
      } else {
        variableName.push(argumentString.trim());
        return variableName;
      }
    }
  }
  //get variables from a READ
  if (lineOfCode.includes(" from ") || lineOfCode.includes(" FROM ")) {
    wordArray=lineOfCode.split(" ");
    position=wordArray.indexOf("from");
    if (position > -1) {
      variableName.push(wordArray[position-1].trim());
      return variableName;
    }
    position=wordArray.indexOf("FROM");
    if (position > -1) {
      variableName.push(wordArray[position-1].trim());
      return variableName;
    }
  }
  //get variables from a FOR TO
  if ((lineOfCode.includes("for ") || lineOfCode.includes("FOR ")) && (lineOfCode.includes(" to ") || lineOfCode.includes("TO ")) && lineOfCode.includes("=")) {
    wordArray=lineOfCode.split(" ");
    position=wordArray.indexOf("for");
    if (position > -1) {
      let thisString=wordArray[position+1]
      thisString=thisString.split("=");
      thisString=thisString[0].trim()
      if (thisString!=null) {
        variableName.push(thisString);
        return variableName;
      }
    }
    position=wordArray.indexOf("FOR");
    if (position > -1) {
      let thisString=wordArray[position+1]
      thisString=thisString.split("=");
      thisString=thisString[0].trim()
      if (thisString!=null) {
        variableName.push(thisString);
        return variableName;
      }
    }
  }
  //get variables from a EQUATE TO
  if ((lineOfCode.includes("equate ") || lineOfCode.includes("EQUATE ")) && (lineOfCode.includes(" to ") || lineOfCode.includes("TO "))) {
    wordArray=lineOfCode.split(" ");
    position=wordArray.indexOf("equate");
    if (position > -1) {
      variableName.push(wordArray[position+1].trim());
      return variableName;
    }
    position=wordArray.indexOf("EQUATE");
    if (position > -1) {
      variableName.push(wordArray[position+1].trim());
      return variableName;
    }
  }
  //get variables from a EQU TO
  if ((lineOfCode.includes("equ ") || lineOfCode.includes("EQU ")) && (lineOfCode.includes(" to ") || lineOfCode.includes("TO "))) {
    wordArray=lineOfCode.split(" ");
    position=wordArray.indexOf("equ");
    if (position > -1) {
      variableName.push(wordArray[position+1].trim());
      return variableName;
    }
    position=wordArray.indexOf("EQU");
    if (position > -1) {
      variableName.push(wordArray[position+1].trim());
      return variableName;
    }
  }
  //get variables from a OPEN
  if (lineOfCode.includes("open ") || lineOfCode.includes("OPEN ")) {
    wordArray=lineOfCode.split(" ");
    position=wordArray.indexOf("to");
    if (position > -1) {
      variableName.push(wordArray[position+1].trim());
      return variableName;
    }
    position=wordArray.indexOf("TO");
    if (position > -1) {
      variableName.push(wordArray[position+1].trim());
      return variableName;
    }
  }
  //Check after THEN
  if (lineOfCode.includes(" then")) {
    lineOfCode=lineOfCode.split(" then")[1];
  }
  if (lineOfCode.includes(" THEN")) {
    lineOfCode=lineOfCode.split(" THEN")[1];
  }
  position=lineOfCode.indexOf("=");
  if (position > 0) {
    var variables = lineOfCode.split("=");
    for (var i = 0; i < variables.length; i++) {
      let thisString = variables[i].trim();;
      let lastCharacter=thisString.substr(thisString.length - 1);
      if (lastCharacter==":" || lastCharacter=="+" || lastCharacter=="-") { continue; }
      if (thisString.includes("(")) { continue; }
      if (thisString.includes("<")) { continue; }
      if (thisString.includes("else") || thisString.includes("ELSE")) { continue; }
      if (thisString.includes("then") || thisString.includes("THEN")) { continue; }
      if (thisString.includes("if") || thisString.includes("IF")) { continue; }
      variableName.push(thisString.trim());
      return variableName;
    }
  }
  return variableName;
}

function loadIntelliSense(): CompletionItem[] {
  // Load new IntelliSense
  Intellisense = [];
  var filePath = __dirname;

  // Use the Language Type setting to drive the language file used for Intellisense
  // MW: Ugly but let's try it for now
  switch (settings.MVBasic.languageType) {
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
    if (settings.MVBasic.useCamelCase === true) {
      Intellisense.push({
        data: Intellisense.length + 1,
        label: keywords[i].key,
        kind: keywords[i].icon,
        detail: keywords[i].detail,
        documentation: keywords[i].documentation
      });
    } else {
      Intellisense.push({
        data: Intellisense.length + 1,
        label: keywords[i].key.toUpperCase(),
        kind: keywords[i].icon,
        detail: keywords[i].detail,
        documentation: keywords[i].documentation
      });
    }
  }

  // Load CustomWord definition
  if (settings.MVBasic.customWordPath !== "") {
    var contents = fs.readFileSync(settings.MVBasic.customWordPath, "utf8");
    settings.MVBasic.customWords = "(";
    var lines = contents.replace("\r", "").split("\n");
    for (let i = 0; i < lines.length; i++) {
      let parts = lines[i].split(":");
      settings.MVBasic.customWords += parts[0].replace('"', "").replace('"', "") + "|";
    }
    settings.MVBasic.customWords = settings.MVBasic.customWords.substr(0, settings.MVBasic.customWords.length - 1) + ")";

    var items = settings.MVBasic.customWords.split("|");
    for (let i = 0; i < items.length; i++) {
      Intellisense.push({
        data: Intellisense.length + 1,
        label: items[i],
        kind: CompletionItemKind.Interface
      });
    }
  }

  // Load CustomFunction definition
  if (settings.MVBasic.customFunctionPath !== "") {
    var functionDefinition = fs.readFileSync(settings.MVBasic.customFunctionPath, "utf8");
    var customFunctionList = JSON.parse(functionDefinition);
    var functions = customFunctionList.Language.functions;
    for (let i = 0; i < functions.length; i++) {
      Intellisense.push({
        data: Intellisense.length + 1,
        label: functions[i].key,
        insertText: functions[i].insertText,
        kind: functions[i].kind,
        detail: functions[i].detail,
        documentation: functions[i].documentation
      });
    }
  }

  if (logLevel) {
    connection.console.log(
      `[Server(${process.pid})] Language definition loaded for ${settings.MVBasic.languageType}`
    );
  }
  return Intellisense;
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
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
  let rStartLoop = new RegExp("(^| )loop( |$)\\s*?", "i");
  let rEndLoop = new RegExp("(^| )repeat( |$)\\s*$", "i");
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

  // Remove all variables from Intellisense to start clean
  if (settings.MVBasic.userVariablesEnabled === true) {
    var i = Intellisense.length;
    while (i--) {
      if (Intellisense[i].kind === CompletionItemKind.Variable) {
        Intellisense.splice(i, 1);
      }
    }
  }

  // first build a list of labels in the program and indentation levels, strip comments, break up ; delimited lines
  let Level = 0;
  var RowLevel: number[] = [lines.length];
  let forNext = []    // FOR statements list
  let forNextErr = [] // FOR NEXT errors list

  for (var i = 0; i < lines.length && problems < settings.MVBasic.maxNumberOfProblems; i++) {
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

    //Check for variable names to add to Intellisens if it does not already exist
    if (settings.MVBasic.userVariablesEnabled === true) {
      let variableNames = getVariableName(line.lineOfCode);
      if (variableNames != null) {
        for (var vc = 0; vc < variableNames.length; vc++) {
          let variableName = variableNames[vc];
          if (variableName != '') {
            var checkVariables = Intellisense.filter(IntellisenseFilter => IntellisenseFilter.label === variableName);
            if (checkVariables.length < 1) {
              Intellisense.push({
                data: Intellisense.length + 1,
                label: variableName,
                kind: CompletionItemKind.Variable
              });
            }
          }
        }
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
    let errorMsg = "Missing NEXT statement - FOR " + o.forVar;
    let line = lines[o.forLine];
    let diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      range: {
        start: { line: line.lineNumber, character: 0 },
        end: { line: line.lineNumber, character: line.lineOfCode.length }
      },
      message: errorMsg,
      source: "MV Basic"
    };
    if (hasDiagnosticRelatedInformationCapability) {
			diagnostic.relatedInformation = [
				{
					location: {
						uri: textDocument.uri,
						range: Object.assign({}, diagnostic.range)
					},
					message: 'NEXT is a required closure for the FOR construct'
				}
			];
		}
    diagnostics.push(diagnostic);
  });

  // Missing END CASE statement
  if (noCase != noEndCase) {
    // find the innermost for
    for (var i = 0; i < lines.length && problems < settings.MVBasic.maxNumberOfProblems; i++) {
      let line = lines[i];
      if (rStartCase.test(line.lineOfCode)) {
        noCase--;
      }
      if (noCase == 0) {
        let diagnostic: Diagnostic = {
          severity: DiagnosticSeverity.Error,
          range: {
            start: { line: line.lineNumber, character: 0 },
            end: { line: line.lineNumber, character: line.lineOfCode.length }
          },
          message: `Missing END CASE statement`,
          source: "MV Basic"
        };
        if (hasDiagnosticRelatedInformationCapability) {
          diagnostic.relatedInformation = [
            {
              location: {
                uri: textDocument.uri,
                range: Object.assign({}, diagnostic.range)
              },
              message: 'END CASE is a required closure for the BEGIN CASE construct'
            }
          ];
        }
        diagnostics.push(diagnostic);
      }
    }
  }

  // Missing REPEAT statement
  if (noLoop != noEndLoop) {
    // find the innermost for
    for (var i = 0; i < lines.length && problems < settings.MVBasic.maxNumberOfProblems; i++) {
      let line = lines[i];
      if (rStartLoop.test(line.lineOfCode)) {
        noLoop--;
      }
      if (noLoop == 0) {
        let diagnostic: Diagnostic = {
          severity: DiagnosticSeverity.Error,
          range: {
            start: { line: line.lineNumber, character: 0 },
            end: { line: line.lineNumber, character: line.lineOfCode.length }
          },
          message: `Missing REPEAT statement`,
          source: "MV Basic"
        };
        if (hasDiagnosticRelatedInformationCapability) {
          diagnostic.relatedInformation = [
            {
              location: {
                uri: textDocument.uri,
                range: Object.assign({}, diagnostic.range)
              },
              message: 'REPEAT is a required closure for the LOOP construct'
            }
          ];
        }
        diagnostics.push(diagnostic);
      }
    }
  }

  // Missing END, END CASE or REPEAT statements
  // if Level is != 0, we have mis matched code blocks
  if (Level > 0) {
    let lastLine = lines[lines.length - 1];
    let diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      range: {
        start: { line: lastLine.lineNumber, character: 0 },
        end: { line: lastLine.lineNumber, character: lastLine.lineOfCode.length }
      },
      message: `Missing END, END CASE or REPEAT statements`,
      source: "MV Basic"
    };
    diagnostics.push(diagnostic);
  }

  // Missing GO, GO TO, GOTO, GOSUB
  // regex to check for goto/gosub in a line
  let rGoto = new RegExp("(^| )(go to|goto|go|gosub)(\\s+.*)", "i");

  for (var i = 0; i < lines.length && problems < settings.MVBasic.maxNumberOfProblems; i++) {
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
          settings.MVBasic.ignoreGotoScope === false
        ) {
          // jumping into or out of a loop
          let index = line.lineOfCode.indexOf(labelName);
          let diagnostic: Diagnostic = {
            severity: DiagnosticSeverity.Warning,
            range: {
              start: { line: line.lineNumber, character: index },
              end: { line: line.lineNumber, character: index + labelName.length }
            },
            message: `${labelName} goes out of scope. Invalid GOTO or GOSUB`,
            source: "MV Basic"
          };
          if (hasDiagnosticRelatedInformationCapability) {
            diagnostic.relatedInformation = [
              {
                location: {
                  uri: textDocument.uri,
                  range: Object.assign({}, diagnostic.range)
                },
                message: 'GOTO and GOSUB should not be used within loops'
              }
            ];
          }
          diagnostics.push(diagnostic);
        }
      } else {
        let index = line.lineOfCode.indexOf(labelName);
        let diagnostic: Diagnostic = {
          severity: DiagnosticSeverity.Error,
          range: {
            start: { line: line.lineNumber, character: index },
            end: { line: line.lineNumber, character: index + labelName.length }
          },
          message: `Label ${labelName} not found! - Invalid GOTO or GOSUB`,
          source: "MV Basic"
        };
        if (hasDiagnosticRelatedInformationCapability) {
          diagnostic.relatedInformation = [
            {
              location: {
                uri: textDocument.uri,
                range: Object.assign({}, diagnostic.range)
              },
              message: 'Labels must be defined in order for a GOTO or GOSUB to function'
            }
          ];
        }
        diagnostics.push(diagnostic);

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
      let diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Warning,
        range: {
          start: { line: label.LineNumber, character: 0 },
          end: { line: label.LineNumber, character: label.LabelName.length }
        },
        message: `Label ${label.LabelName} is not referenced`,
        source: "MV Basic"
      };
      if (hasDiagnosticRelatedInformationCapability) {
        diagnostic.relatedInformation = [
          {
            location: {
              uri: textDocument.uri,
              range: Object.assign({}, diagnostic.range)
            },
            message: 'Labels should only be defined when needed for a GOTO or GOSUB'
          }
        ];
      }
      diagnostics.push(diagnostic);
    }
  });
  // Send the computed diagnostics to VSCode.
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

/* Connection Events */
// Listen on the connection
connection.listen();

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

connection.onInitialize(
  (params: InitializeParams): InitializeResult => {
    let capabilities = params.capabilities;

    // Does the client support the `workspace/configuration` request?
    // If not, we fall back using global settings.
    hasConfigurationCapability = !!(
      capabilities.workspace && !!capabilities.workspace.configuration
    );
    hasWorkspaceFolderCapability = !!(
      capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );
    hasDiagnosticRelatedInformationCapability = !!(
      capabilities.textDocument &&
      capabilities.textDocument.publishDiagnostics &&
      capabilities.textDocument.publishDiagnostics.relatedInformation
    );

    if (logLevel) {
      connection.console.log(
        `[Server(${process.pid})] Started and initialize received`
      );
    }
    
    const result: InitializeResult = {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        // Tell the client that this server supports code completion.
        completionProvider: {
          resolveProvider: true
        },
        definitionProvider: true,
        referencesProvider: true,
        documentSymbolProvider: true,
        hoverProvider: true
      }
    };

    if (hasWorkspaceFolderCapability) {
      result.capabilities.workspace = {
        workspaceFolders: {
          supported: true
        }
      };
    }

    return result;
  }
);

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The settings have changed. Is send on server activation as well.
connection.onNotification("languagePath", (path: string) => {
  path = path + "";
});

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: Settings = { 
  MVBasic: {
    maxNumberOfProblems: 100,
    useCamelCase: true,
    userVariablesEnabled: false,
    ignoreGotoScope: false,
    customWords: "",
    customWordPath: "",
    customFunctionPath: "",
    languageType: "MVON",
    trace: "off"
  }
 };
let settings: Settings = defaultSettings;

connection.onDidChangeConfiguration(change => {
  if (change.settings) {
    settings = <Settings>change.settings;
    const _logLevel = <string>(settings.MVBasic.trace && settings.MVBasic.trace.server);
    switch (_logLevel) {
      case 'messages': logLevel = 1; break;
      case 'verbose': logLevel = 2; break;
      default: logLevel = 0;
    }
    loadIntelliSense();

    // Revalidate any open text documents
    documents.all().forEach(validateTextDocument);
  }
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
              if (!Intellisense.some(statementLabel => statementLabel['label'] === LabelList[i].LabelName)) {
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
