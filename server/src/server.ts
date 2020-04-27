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
  TextDocument,
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
  MarkedString,
  Hover
} from "vscode-languageserver";

import fs = require("fs");
import * as path from "path";

/* Initialize Variables */

// Create a connection for the server. The connection uses Node's IPC as a transport
let connection: IConnection = createConnection(
  new IPCMessageReader(process),
  new IPCMessageWriter(process)
);

let currentDocument = "";
let useCamelcase = true;
let ignoreGotoScope = false;
let shouldSendDiagnosticRelatedInformation: boolean | undefined = false;

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
  languageType: string;
  trace: any; // expect trace.server is string enum 'off', 'messages', 'verbose'
}

let maxNumberOfProblems: number;
let customWordList: string;
let customWordPath: string;
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
let documents: TextDocuments = new TextDocuments();

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
  currentDocument = change.document.getText();
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
  let xpos = 0;
  let startpos = 0;
  while (xpos < line.length) {
    if (line.substr(xpos, 1) == " " || line.substr(xpos, 1) == "=") {
      wordCount--;
      if (wordCount == 0) {
        return line.substr(startpos, xpos - startpos);
      }
      startpos = xpos + 1;
    }

    xpos++;
  }
  return line.substr(startpos, xpos - startpos);
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

  if (logLevel) {
    connection.console.log(
      `[Server(${process.pid})] Language definition loaded for ${languageType}`
    );
  }
  return Intellisense;
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
  let rLabel = new RegExp(
    "(^[0-9]+\\b)|(^[0-9]+)|(^[0-9]+:\\s)|(^[\\w\\.]+:(?!\\=))",
    "i"
  );
  // regex for statements that start a block
  let rBlockStart = new RegExp(
    "(^if |begin case|^readnext |open |read |readv |readu |locate |openseq |matread |create |readlist |openpath |find |findstr )",
    "i"
  );
  let rBlockAlways = new RegExp("(^for |^loop)", "i");
  let rBlockContinue = new RegExp("(then$|else$|case$|on error$)", "i");
  let rBlockEnd = new RegExp(
    "^(end|end case|repeat|.+repeat$|next\\s.+)$",
    "i"
  );
  let rStartFor = new RegExp("^(for )", "i");
  let rStartLoop = new RegExp("(^loop)", "i");
  let rStartCase = new RegExp("(^begin case)", "i");
  let rEndFor = new RegExp("(^next\\s)", "i");
  let rEndLoop = new RegExp("(repeat$)", "i");
  let rEndCase = new RegExp("(^end case)", "i");
  let rElseEnd = new RegExp("^(end else\\s.+)", "i");
  let rComment = new RegExp("(^\\s*\\*.*|^\\s*!.*|^\\s*REM.*)", "i"); // (Start-of-line 0-or-more whitespace {* ! REM} Anything)
  let tComment = new RegExp("(^.+)(;\\s*\\*.*|;\\s*!.*|;\\s*REM.*)", "i"); // (something)(; {whitespace} {* ! REM} Anything)
  let lComment = new RegExp("(^\\s*[0-9]+)(\\s*\\*.*)"); // number label with comments after
  let trailingComment = new RegExp("(\\*.+)|(;+)");
  let qStrings = new RegExp(
    "(\"([^\"]|\"\")*\")|('([^']|'')*')|(\\\\([^\\\\]|\\\\\\\\)*\\\\)",
    "g"
  );
  let noCase = 0;
  let noLoop = 0;
  let noEndLoop = 0;
  let noEndCase = 0;
  let forDict = new Map<string, any>();
  // first build a list of labels in the program and indentation levels, strip comments, break up ; delimited lines
  let Level = 0;
  var RowLevel: number[] = [lines.length];
  for (var i = 0; i < lines.length && problems < maxNumberOfProblems; i++) {
    let line = lines[i];
    // ignore all comment lines
    if (rComment.test(line.trim()) === true) {
      continue;
    }
    // remove trailing comments with a semi-colon
    if (tComment.test(line.trim()) === true) {
      let comment = tComment.exec(line.trim()); // This does the regex match again, but assigns the results to comment array
      line = comment![1];
    }

    // remove comments after label (no semi-colon)
    if (lComment.test(line.trim()) === true) {
      let comment = lComment.exec(line.trim()); // This does the regex match again, but assigns the results to comment array
      line = comment![1];
    }

    /* Before we do anything else, split line on ; *except* inside strings or parens.
		   Ug! One problem with this approach is it throws off the line number in the error report...
		   This helps deal with lines like: FOR F=1 TO 20;CRT "NEW;":REPLACE(REC<F>,1,0,0;'XX');NEXT F ;* COMMENT
			 There may be a way to do this with regexp, but it gets super hairy.
			 See: https://stackoverflow.com/questions/23589174/regex-pattern-to-match-excluding-when-except-between
		*/
    if (line.indexOf(";") > 0) {
      let inString = false;
      for (var j = 0; j < line.length; j++) {
        let ch = line.charAt(j);
        if (
          ch === '"' ||
          ch === "'" ||
          ch === "\\" ||
          ch === "(" ||
          ch === ")"
        ) {
          inString = !inString;
        }
        if (ch === ";" && !inString) {
          let left = line.slice(0, j);
          let right = line.slice(j + 1);
          // Push the right side into the array lines, and deal with it later (including more splitting)
          lines[i] = left;
          lines.splice(i + 1, 0, right);
          line = left;
          break;
        }
      }
    }

    // check opening and closing block FOR/NEXT
    if (rStartFor.test(line.trim())) {
      let forvar = getWord(line.trim(), 2);
      let o = forDict.get(forvar);
      if (typeof o == "undefined") {
        o = { ctr: 1, line: i };
      } else {
        o = { ctr: o.ctr + 1, line: i };
      }
      forDict.set(forvar, o);
    }
    if (rEndFor.test(line.trim())) {
      let nextvar = getWord(line.trim(), 2);
      let o = forDict.get(nextvar);
      if (typeof o == "undefined") {
        o = { ctr: -1, line: i };
      } else {
        o = { ctr: o.ctr - 1, line: i };
      }
      forDict.set(nextvar, o);
    }

    // Check for CASE/LOOP
    if (rStartCase.test(line.trim()) == true) {
      noCase++;
    }
    if (rEndCase.test(line.trim()) == true) {
      noEndCase++;
    }
    if (rStartLoop.test(line.trim()) == true) {
      noLoop++;
    }
    if (rEndLoop.test(line.trim()) == true) {
      noEndLoop++;
    }
    // check block statements
    if (rBlockStart.test(line.trim()) == true) {
      Level++;
      if (rBlockContinue.test(line.trim()) == false) {
        // single line statement
        Level--;
      }
    }
    ``;
    if (rBlockAlways.test(line.trim())) {
      Level++;
    }
    if (rBlockEnd.test(line.trim())) {
      Level--;
    }
    if (rElseEnd.test(line.trim()) == true) {
      // decrement 1 to cater for end else stements
      Level--;
    }
    // 10  10:  start: labels
    if (rLabel.test(line.trim()) === true) {
      let label = "";
      if (line !== null) {
        let labels = rLabel.exec(line.trim());
        if (labels !== null) {
          label = labels[0].trim().replace(":", "");
        }
      }
      LabelList.push(new Label(label, i, Level, false));
    }
    RowLevel[i] = Level;
  }
  // if we have unmatched specific blocks then display error
  // First FOR/NEXT unbalanced
  for (let forvar of forDict.keys()) {
    let o = forDict.get(forvar);
    let errorMsg = "";
    if (o.ctr != 0) {
      if (o.ctr > 0) {
        errorMsg = "Missing NEXT Statement - FOR " + forvar;
      } else {
        errorMsg = "Missing FOR Statement - NEXT " + forvar;
      }
      let lineNo = o.line;
      let diagnosic: Diagnostic = {
        severity: DiagnosticSeverity.Error,
        range: {
          start: { line: lineNo, character: 0 },
          end: { line: lineNo, character: lines[lineNo].length }
        },
        message: errorMsg,
        source: "MV Basic"
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

  if (noCase != noEndCase) {
    // find the innermost for
    let line = "";
    for (var i = 0; i < lines.length && problems < maxNumberOfProblems; i++) {
      line = lines[i];
      if (rStartCase.test(line.trim()) == true) {
        noCase--;
      }
      if (noCase == 0) {
        break;
      }
    }
    let diagnosic: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      range: {
        start: { line: i, character: 0 },
        end: { line: i, character: lines[i].length }
      },
      message: `Missing END CASE statement`,
      source: "MV Basic"
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
          message: "Missing END CASE statement"
        }
      ];
    }
    diagnostics.push(diagnosic);
  }
  if (noLoop != noEndLoop) {
    // find the innermost for
    let line = "";
    for (var i = 0; i < lines.length && problems < maxNumberOfProblems; i++) {
      line = lines[i];
      if (rStartLoop.test(line.trim()) == true) {
        noLoop--;
      }
      if (noLoop == 0) {
        break;
      }
    }
    let diagnosic: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      range: {
        start: { line: i, character: 0 },
        end: { line: i, character: lines[i].length }
      },
      message: `Missing REPEAT statement`,
      source: "MV Basic"
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
          message: "Missing REPEAT statement"
        }
      ];
    }
    diagnostics.push(diagnosic);
  }
  // if Level is != 0, we have mis matched code blocks
  if (Level > 0) {
    let lastLineLength = lines[lines.length - 1].length;

    let diagnosic: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      range: {
        start: { line: lines.length, character: 0 },
        end: { line: lines.length, character: lastLineLength }
      },
      message: `Missing END, END CASE or REPEAT statements`,
      source: "ex"
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
          message: "One of the code blocks is missing an END"
        }
      ];
    }
    diagnostics.push(diagnosic);
  }
  // regex to check for goto/gosub in a line
  let rGoto = new RegExp("((gosub|goto|go|go to)\\s\\w+)", "ig");
  for (var i = 0; i < lines.length && problems < maxNumberOfProblems; i++) {
    let line = lines[i];
    // ignore comment lines
    if (rComment.test(line.trim()) == true) {
      continue;
    }
    // remove trailing comments
    if (tComment.test(line.trim()) == true) {
      let comment = tComment.exec(line.trim());
      if (comment !== null) {
        line = line.trim().replace(comment[0], "");
      }
    }
    lComment.lastIndex = 0;
    if (lComment.test(line.trim()) === true) {
      let comment = trailingComment.exec(line.trim());
      if (comment !== null) {
        line = line.trim().replace(comment[0], "");
      }
    }
    // remove any quoted string
    qStrings.lastIndex = 0;
    while (qStrings.test(line) == true) {
      qStrings.lastIndex = 0;
      let str = qStrings.exec(line);
      if (str !== null) {
        line = line.replace(str[0], "");
      }
      qStrings.lastIndex = 0;
    }

    // check any gosubs or goto's to ensure label is present
    rGoto.lastIndex = 0;
    if (rGoto.test(line.trim()) == true) {
      while (line.indexOf(",") > -1) {
        line = line.replace(",", " ");
      }
      let values = line.replace(";", " ").split(" ");
      let found = false;
      let labelName = "";
      let checkLabel = "";
      let cnt = 0;
      values.forEach(function(value) {
        cnt++;
        if (
          value.toLowerCase() == "goto" ||
          value.toLowerCase() == "gosub" ||
          value.toLowerCase() == "go"
        ) {
          while (cnt < values.length) {
            labelName = values[cnt]
              .replace(";", "")
              .replace("*", "")
              .replace(":", "");
            if (labelName === "to") {
              cnt++;
              labelName = values[cnt]
                .replace(";", "")
                .replace("*", "")
                .replace(":", "");
            }
            LabelList.forEach(function(label) {
              checkLabel = label.LabelName;
              if (checkLabel == labelName) {
                found = true;
                // set the referened flag
                label.Referenced = true;
                if (
                  label.Level != RowLevel[i] &&
                  label.Level > 1 &&
                  ignoreGotoScope === false
                ) {
                  // jumping into or out of a loop
                  let index = line.indexOf(labelName);
                  let diagnosic: Diagnostic = {
                    severity: DiagnosticSeverity.Error,
                    range: {
                      start: { line: i, character: index },
                      end: { line: i, character: index + labelName.length }
                    },
                    message: `${labelName} is trying to go out of scope`,
                    source: "ex"
                  };
                  if (shouldSendDiagnosticRelatedInformation) {
                    diagnosic.relatedInformation = [
                      {
                        location: {
                          uri: textDocument.uri,
                          range: {
                            start: { line: i, character: index },
                            end: {
                              line: i,
                              character: index + labelName.length
                            }
                          }
                        },
                        message:
                          "Invalid GOTO or GOSUB, jumping into/out of a block"
                      }
                    ];
                  }
                  diagnostics.push(diagnosic);
                }
              }
            });
            cnt++;
            if (!found) {
              let index = line.indexOf(labelName);
              let diagnosic: Diagnostic = {
                severity: DiagnosticSeverity.Error,
                range: {
                  start: { line: i, character: index },
                  end: { line: i, character: index + labelName.length }
                },
                message: `${labelName} is not defined as a label in the program`,
                source: "MV Basic"
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
                    message: "Invalid GOTO or GOSUB"
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
  LabelList.forEach(function(label) {
    if (label.Referenced === false) {
      let diagnosic: Diagnostic = {
        severity: DiagnosticSeverity.Warning,
        range: {
          start: { line: label.LineNumber, character: 0 },
          end: { line: label.LineNumber, character: label.LabelName.length }
        },
        message: `${label.LabelName} is not referenced in the program`,
        source: "MV Basic"
      };
      if (shouldSendDiagnosticRelatedInformation) {
        diagnosic.relatedInformation = [
          {
            location: {
              uri: textDocument.uri,
              range: {
                start: { line: label.LineNumber, character: 0 },
                end: {
                  line: label.LineNumber,
                  character: label.LabelName.length
                }
              }
            },
            message:
              "Label not referenced in the program; consider removing if unnecessary."
          }
        ];
      }
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
        textDocumentSync: documents.syncKind,
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
  let doc = documents.get(uri);
  let xpos = params.position.character;
  let ypos = params.position.line;
  let lines = currentDocument.split(/\r?\n/g);
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
  return locations;
});

connection.onDocumentSymbol(params => {
  let uri = params.textDocument.uri;
  let doc = documents.get(uri);
  let lines = doc.getText().split(/\r?\n/g);
  let rInclude = new RegExp(
    "^(include |\\$include |\\s+include |\\s+\\$include)",
    "i"
  );
  let rGoto = new RegExp("(call )", "i");

  let ans: SymbolInformation[] = [];

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
    if (rGoto.test(line.trim()) === true) {
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
    if (rInclude.test(line.trim()) === true) {
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

  return ans;
});

connection.onDefinition(params => {
  let x = params.textDocument.uri;
  let xpos = params.position.character;
  let ypos = params.position.line;
  let lines = currentDocument.split(/\r?\n/g);
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
    x = parts.join("/");
    let newProgram = Location.create(x, {
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
    x = parts.join("/");
    let newProgram = Location.create(x, {
      start: { line: 0, character: 0 },
      end: { line: 0, character: line.length }
    });
    return newProgram;
  }
  //let rLabel = new RegExp("(^[0-9]+\\s)|(^[0-9]+:\\s)|(^[\\w\\.]+:)", "i");
  let rLabel = new RegExp(
    "(^[0-9]+\\b)|(^[0-9]+)|(^[0-9]+:\\s)|(^[\\w\\.]+:(?!\\=))",
    "i"
  );
  for (var i = 0; i < lines.length; i++) {
    line = lines[i];
    if (rLabel.test(line.trim()) == true) {
      let label = "";
      if (line !== null) {
        let labels = rLabel.exec(line.trim());
        if (labels !== null) {
          label = labels[0].trim().replace(":", "");
        }
      }
      if (label == definition) {
        return Location.create(x, {
          start: { line: i, character: 0 },
          end: { line: i, character: label.length }
        });
      }
    }
  }

  return Location.create(x, {
    start: { line: params.position.line, character: params.position.character },
    end: { line: params.position.line, character: params.position.character }
  });
});

connection.onHover((params: TextDocumentPositionParams): Hover | undefined => {
  if (Intellisense === undefined) {
    return undefined;
  }
  let xpos = params.position.character;
  let ypos = params.position.line;
  let lines = currentDocument.split(/\r?\n/g);
  let line = lines[ypos];
  while (xpos > 0) {
    let char = line.substr(xpos, 1);
    if (char == " ") {
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
      let doc: MarkedString[] = [];
      for (let i = 0; i < detail.length; i++) {
        doc.push("```\r\n");
        doc.push(detail[i] + "  \r\n\r\n");
        doc.push("```\r\n");
      }
      doc.push("\r\n\r\n");

      for (let i = 0; i < documentation.length; i++) {
        doc.push(documentation[i] + "  \r\n\r\n");
      }

      return {
        contents: doc
      };
    }
  }
  return undefined;
});

/* OLD CODE
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
