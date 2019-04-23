## Changelog


### 1.0.0

Initial release of MV# extension

### 1.8.0

Fixed compile and catalog commands

### 1.9.0

Added intelligent FOR/NEXT error detection

### 1.12.0
Minor bug fixes when server crashes

### 1.14.0
Fixed formatting error and updated more Intellisense

### 1.16.0
Added internal subroutines not referenced  
Added Camel Case flag for intellisense  
Fixed formatting and linting errors on GOTO/GOSUB  
Added more Intellisense  

### 1.17.0
Added compile with debug menu item  
Added remote compile for MVON# users, 

### 1.22.0
Added remote file system support

### 1.26.0
Fix bug with trailing comments and the linter

### 1.27.0
Added Go To/Peek definitions for Subroutine Calls, Includes and Chains  
If a compile generates an error, the cursor is placed on the line of the first error  

### 1.28.0
Fixed formatting where trailing comments of then/else  

### 1.29.0
Added Find All References  

### 1.31.0
Fixed linter for labels with '.'
Added Gateway for access to QM, D3, Universe and Unidata to remote editing

### 1.34.0
Fixed Gosub/Goto with labels ending with ;  
Fixed Highlighting of Literals  
Added Compile/Catalog to programs connected with the Gateway  

### 1.35.0
Fix partial highlighting of Functions  
Fix Gateway credentials for D3/mvBase  


### 1.36.0
Fix Gateway Issues  

### 1.39.0
Fixed linter issues with FOR statement  
Gateway tested against QM,D3,jBASE,Universe,Unidata  
    
### 1.40.0
Fix linting for labels that have '*' after label  

### 1.41.0
Fix linting for GOTO starting after ;  
add mvon.ignoreGotoScope setting to disable the linter from checking for GOTO's that jump into loops  

### 1.42.0
Fixed Gateway to support mvBase. The Gateway needs to be re installed  

### 1.44.0
Fixed ON X GOTO 1,2,3 references  
Added internal subroutine intellisense when using GOTO/GOSUB, press Ctl-Space  

### 1.45.0
Fixed false positives on invalid GOTO/GOSUB  
Added encoding to support multi national character sets  

### 1.46.0
Set D3/mvBase port to 9003  

### 1.47.0
Fix linting issue where numeric labels have trailing comments  
Fix linting and formatting issue for "end else statement..."  
Fix MvonGateway not releasing database connnections when workspace is closed  

### 1.49.0
Added 3 setting, mvon.margin and mvon.indent and mvon.formattingEnabled for code formatting  
Added mvon.addionalFiles for a user defined list of files to include  
Fixed formatting issueds  

### 1.56.0
Fixed formatting with 0 margin  
Fixed comments at the end of a numeric label  

### 1.58.0
Added mvon.gatewayDebug setting on the MvonGateway to log communications with the gateway in c:\Temp\mvonGateway.log  
Updated the Gateway to Allow a list of files on jBASE and D3/mvBase in MD / MVONFILES courtesy of Maverick Systems  

### 1.60.0
Fix gateway issues with Unidata  

### 1.61.0
Fix formating issue with LOCATE function  

### 1.62.0
Fix '/' and '\' in the Gateway for Universe/Unidata on Unix  

### 1.64.0
Fix comment lines starting with ! and *  
Added EQU and EQUATE to reserved words  

### 1.67.0
Fix comment line with *  
Add # as an operator  
Fixed := confused as a label  

### 1.68.0  
Fix formatting with WRITE ELSE  
Fixed REM as a comment line  
Fixed Regex Bug found by Ian Harper  

### 1.69.0 
Add code outline for internal subroutines, includes and subroutine calls  

### 1.70.0 
Fix linter for := and labels  

### 1.71.0  
Fix Bug with useCamelCase  

### 1.72.0  
Add formatting support for KEY and LOCK  

### 1.73.0
Add addionalFiles parameter to manually add files to the list  

### 1.74.0  
Added 2 news settings, mvon.customWords and mvon.customWordColor.
Any words int this list will be higlighted with the color and added to Intellisense  

### 1.83.0
Added mvon.customWordPath, file contains key value pair seperated by : for custome words and intellisense  

### 1.84.0
Last update crashed the extension. Applied fixes  

