* Starred comment
! Exclamation comment
REM Remark comment
*
* Includes/Equates
*
$INCLUDE MD MD
INCLUDE MD MD
EQU D 123
EQUATE E JKL
*
* Strings
*
A="ABC" ;* Easy one
B='123' ;! Also easy
C=\XYZ\ ;REM Backslash is also available?
*
A="TOYS'R'US"                   ;* How about embedded in a string?
B='QUOTE "UNQUOTE"'             ;* Or the other way around?
C=\I'M THE KING OF THE "WORLD"\ ;* All the quotes
*
A=1 ; B=2 ; C=3 ;* Multiline ok?
CRT A,B,C,D,E
*
* FOR Loops
*
FOR F=1 TO 20
  CRT F
NEXT F
*
* One-liner, ptooey!
FOR G=1 TO 100 ; CRT G ; NEXT G ;* TRAILING COMMENT
*
* Nested
FOR H=1 TO 10
  FOR I=1 TO H
    CRT I,H
  NEXT I
NEXT H
*
* IF/THEN/ELSE
*
IF A=B THEN
  CRT "EQUAL"
END
*
IF A # B THEN
  CRT 'NOT EQUAL'
END ELSE
  CRT 'EQUAL'
END
*
IF B=C THEN CRT 'B AND C EQUAL' ; CRT "DON'T KNOW ABOUT A" ; STOP
*
* LOOP/UNTIL/WHILE/REPEAT
*
X=1
SELECT MD
LOOP
  READNEXT ID ELSE EXIT
  X+=1
UNTIL X=100 DO
  CRT X, ID
REPEAT
*
* BEGIN CASE/END CASE
*
BEGIN CASE
  CASE A=1
    CRT 'A'
  CASE B=2
    CRT 'B'
  CASE C=3
    CRT 'C'
  CASE 1
    CRT 'OTHER'
END CASE
*
* OPEN/READ/WRITE
*
10
OPEN 'MD' TO MD ELSE STOP 'CANNOT OPEN MD'
20:
READ R FROM MD, 'MD' THEN CRT R<1> ELSE CRT 'CANNOT READ MD'
30: * Label with a comment
READ R FROM MD, 'MD' THEN
  CRT R<1>
END ELSE
  CRT 'CANNOT READ MD'
END
*
* LABELS/GOTO/GOSUB
*
IF A=1 THEN GOTO 10
IF B=2 THEN GOTO 20
IF C=3 THEN GOTO 30
IF C=4 THEN GOTO SKIP
GOSUB REMARKABLE
SKIP:
STOP
*
REMARKABLE:
  CRT 'TESTING'
  IF A=10 THEN RETURN TO 10
RETURN
*
* Final END statement, no executable statements allowed after this
END
CRT 'ABC'
