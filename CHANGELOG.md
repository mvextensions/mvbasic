# Changelog

## 2.0.0

- Initial release of the MV Basic extension under the MV Extensions project

## 2.0.1

- Add in jBASE language files

## 2.0.2

- Internal build

## 2.0.3

- Internal build

## 2.0.4

- Add AccuTerm connector for RestFS
- Improve RestFS API
- Add "Language Type" setting for dynamic IntelliSense
- Improve Regex for comments, split lines and for/next
- Improve docs
- Add additional language syntax test files

## 2.0.5

- Fix formattingEnabled setting to correctly enable/disable auto formatting
- Improve RestFS API
- Fix formatting issue with spacing and blank lines

## 2.0.6

- Crushed many Regex bugs with the language server
- Better recognition of keywords
- Fixed erroneous warnings and errors
- Fixed language server JavaScript errors
- Fixed incorrect line matching for legitimate warnings and errors
- Fixed bug that introduced spaces to blank lines
- Introduced webpack to bundle the extension
- Removed docs from the bundled extension (they can still be accessed online at the repo)
- Improvements to RestFS API

## 2.0.7

- Fixed a bug with the "customWordPath" option (#24)
- Fixed auto-formatting bug (#45)
- Added documentation for the RestFS API (#89)
- Fixed bug with space-prefixed labels (#96)
- Improved linting (#98)
- Improved label detection with GOTO/GOSUB (#99)
- Fixed bug with FOR/NEXT linting with labels (#104)

## 2.0.8

- Fixed a bug with FOR/NEXT recognition and spacing (#107)

## 2.0.9

- Fixed a bug with LOOP/REPEAT recognition and spacing (no issue)
- Fixed a bug with formatting for comment lines (#110)
- Added new indentComment setting to control comment indentation (#111)
- Added new customFunctionPath setting to allow users to contribute custom functions/subroutines for IntelliSense and linting (#113)

### 2.0.10

- Fixed bug with customFunctionPath

### 2.0.11

- Fixed bug with customFunctionPath and improved jBASELanguage.json
