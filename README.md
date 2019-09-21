# MVBasic Extension

This [Visual Studio Code][vs_code] extension is used for syntax highlighting, IntelliSense and program formating for PickBasic code development. We hope this project to sparks a sense of community involvement and action within the MultiValue and Pick Database space and if that is exciting to you, we'd love to have you help out! Please see our [Contribution Guidelines][contribution_guidelines] and [Code of Conduct][code_of_conduct] for more information.

## Installation

The easiest way to use this extension is to download it from the [Visual Studio Code Marketplace][vs_code_market]. Of course if you'd prefer you may also clone and run the code locally. To do the latter, you will need:

1. [Node.js](https://nodejs.org/en/download/)
2. [Git](https://git-scm.com/downloads)
3. Clone the repository from GitHub (`git clone https://github.com/mvextensions/mvbasic.git`)
4. Open the cloned copy in an IDE. We'd suggest using [Visual Studio Code](https://code.visualstudio.com/) because that's why we're all here right?
5. Run `npm install` from the command line wherever you cloned the project. VS Code makes this easy, with the project open just open a new terminal window in the editor.
6. Congratulations! You're setup to work on the code.

To debug, make sure you run the debugger for the following configurations (these are provided in the `.vscode/launch.json` file).

1. Launch Client
2. Attach to Server

## Features

This extension includes the following features:

- Syntax highlighting
- IntelliSense
- Code folding
- Code formatting
- Goto/Peek Definition
  - Automatically jump to and peek internal subroutines
  - Automatically peek/load CALL, CHAIN and INCLUDE routines
- Syntax checking for:
  - GOTO/GOSUB's
  - LOOPS
  - CASE statements
  - IF THEN/ELSE statements
- Access your remote MultiValue files and programs
- Find all References of a word in current program
- Shows outline of internal subroutines, include files and subroutine calls

## Participate

- Ask or respond to questions on [Stack Overflow](https://stackoverflow.com/tags/mvextensions). Please be sure to follow their guidelines for well-formed questions and answers.
- Report a bug or request a new feature in the repo [Issue tracker](https://github.com/mvextensions/mvbasic/issues).
- Learn about [Contributing](https://github.com/mvextensions/.github/blob/master/CONTRIBUTING.md) with code, documentation, or testing.
- Open a discussion in the [MVDBMS Google Group](https://groups.google.com/d/forum/mvdbms). Please specify "\[MVExtensions\]" in your subject.
- Get more immediate feedback in the [mvTalk Slack Team](https://mvtalk.slack.com). See channel #mvextensions.
- Try the [Gitterm.IM/mvextensions/community](https://gitter.im/mvextensions/community) chat group

## Credit

This extension would not be possible without the hard work by Grant Hart, Perry Stauffer and the rest of the team at [OnGroup][on_group].

## Maintainers

- [@andytakacs][maint_andy_takacs]
- [@CharlesBarouch][maint_charles_barouch]
- [@dthiot][maint_dick_thiot]
- [@GrantHart][maint_grant_hart]
- [@itsxallwater][maint_mike_wright]
- [@patrickp][maint_patrick_payne]
- [@PerryStauffer][maint_perry_stauffer]
- [@pschellenbach][maint_pete_schellenbach]

## Contributors

- [@andrewcole50](https://github.com/andrewcole50)
- [@frostyjhammer](https://github.com/frostyjhammer)
- [@ianmcgowan](https://github.com/ianmcgowan)
- [@JeffTeter](https://github.com/JeffTeter)
- [@mikes-zum](https://github.com/mikes-zum)
- [@MVDBMS-Solutions](https://github.com/MVDBMS-Solutions)

[code_of_conduct]: https://github.com/mvextensions/.github/blob/master/CODE_OF_CONDUCT.md
[contribution_guidelines]: https://github.com/mvextensions/.github/blob/master/CONTRIBUTING.md
[maint_andy_takacs]: https://github.com/andytakacs
[maint_charles_barouch]: https://github.com/CharlesBarouch
[maint_dick_thiot]: https://github.com/dthiot
[maint_grant_hart]: https://github.com/GrantHart
[maint_mike_wright]: https://github.com/itsxallwater
[maint_patrick_payne]: https://github.com/patrickp
[maint_perry_stauffer]: https://github.com/PerryStauffer
[maint_pete_schellenbach]: https://github.com/pschellenbach
[on_group]: http://www.ongroup.com
[vs_code]: https://code.visualstudio.com/
[vs_code_market]: https://marketplace.visualstudio.com/vscode
