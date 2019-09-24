    PROGRAM SYNTAX.TEST
*
    INCLUDE PGM LINE1
    $INCLUDE PGM LINE2
    INSERT PGM LINE3
    $INSERT PGM LINE4
* 
    OPEN "","TESTFILE" TO F.TEST ELSE STOP 201, "TESTFILE"
*

iconv
    CRT
    CRT "@ACCOUNT        = " : @ACCOUNT
    CRT "@AM             = " : @AM
    CRT "@APPLICATION.ID = " : @APPLICATION.ID
    CRT "@CALLSTACK      = " : @CALLSTACK
    CRT "@CODEPAGE       = " : @CODEPAGE
    CRT "@COMMAND        = " : @COMMAND
    CRT "@DATA           = " : @DATA
    CRT "@DATE           = " : @DATE
    CRT "@DAY            = " : @DAY
    CRT "@EOF            = " : @EOF
    CRT "@ESC            = " : @ESC
    CRT "@FALSE          = " : @FALSE
    CRT "@FILENAME       = " : @FILENAME
    CRT "@FF             = " : @FF
    CRT "@FM             = " : @FM
    CRT "@ID             = " : @ID
    CRT "@IM             = " : @IM
    CRT "@LEVEL          = " : @LEVEL
    CRT "@LF             = " : @LF
    CRT "@LOCALE         = " : @LOCALE
    CRT "@LOGNAME        = " : @LOGNAME
    CRT "@LPTRHIGH       = " : @LPTRHIGH
    CRT "@MONTH          = " : @MONTH
    CRT "@PARASENTENCE   = " : @PARASENTENCE
    CRT "@PATH           = " : @PATH
    CRT "@PID            = " : @PID
    CRT "@RECORD         = " : @RECORD
    CRT "@SELECTED       = " : @SELECTED
    CRT "@TIME           = " : @TIME
    CRT "@TIMEZONE       = " : @TIMEZONE
    CRT "@TTY            = " : @TTY
    CRT "@UID            = " : @UID
    CRT "@USER           = " : @USER
    CRT "@USERNO         = " : @USERNO
    CRT "@VM             = " : @VM
    CRT "@WHO            = " : @WHO
    CRT "@YEAR           = " : @YEAR
*
*   ABORT 66, "Aborted"
*
    CRT
    CRT "Result of BITAND(6,12) is " : BITAND(6,12)
    CRT "Result of BITLOAD()    is " : BITLOAD()
*
    CRT
*
    A = "AAABBBCCCDDDBBB"
    CRT "Result of EREPLACE#1   is " : EREPLACE(A,"BBB","ZZZ")
    CRT "Result of EREPLACE#2   is " : EREPLACE(A,"","ZZZ")
    CRT "Result of EREPLACE#3   is " : EREPLACE(A,"BBB","")
*
    GROUPSTORE "XXX" IN A USING 1,1
    CRT "Result of GROUPSTORE   is " : A
*
    B = "ABC  DEF    GHI"
    CRT "Result of TRIMS(B)     is " : TRIMS(B)
*
    I = 1
    CRT "Value of I             is " : I
*
    * Multiplication
    i = 10
    i = i * 7
    i = i * 7 ;* Comment after semi-colon
    i = i * 7 ;! Comment after semi-colon    
* Line Comment
! Line Comment
    * Line Comment with Preceding white Space
    ! Line Comment with Preceding white Space
    *
    !
100 * Numerical label followed by Comment
100 ! Numerical label followed by Comment
A.Label: * Text label followed by comment
A.Label: ! Text label followed by comment
END