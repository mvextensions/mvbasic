PROGRAM NEW.SYNTAX.TEST
*
    $option jabba
*
    CRT "@ACCOUNT        = " : @ACCOUNT
* ABORT
* Open a file with random name (just to make sure that it doesn't exist)
    V.FNAME = ''
    FOR V.J = 1 TO 8
        V.RND = RND(26) + 65
        V.FNAME := CHAR(V.RND)        ;* A...Z
    NEXT V.J
    OPEN V.FNAME TO F.RAND ELSE ABORT 201, V.FNAME
* ABS
    CRT "Result of ABS(10-15) is " : ABS(10-15)
* ABSS
    V.BEFORE = 500: @VM: 400: @VM: 300 :@SM: 200 :@SM: 100
    V.AFTER = SUBS(V.BEFORE, REUSE(300))     ;* decrease each element by 300
    CRT "Result is : " : OCONV( ABSS(V.AFTER), 'MCP' )        ;*  200]100]0\100\200
* ADDS
    Array1 = 2 :@VM: 4 :@VM: 6 :@SM: 10
    Array2 = 1 :@VM: 2: @VM: 3 :@VM: 4
    CRT "Result is : " : OCONV( ADDS(Array1, Array2), 'MCP' )   ;*  3]6]9\10]4
* ALPHA
    Abc = "ABC"
    IF ALPHA(Abc) THEN CRT "Variable is Alphabetic"
    Abc = "123"
    IF NOT(ALPHA(Abc)) THEN CRT "Variable is Non-alphabetic"
* ANDS
    A = 1:@SM:4:@VM:4:@SM:1
    B = 1:@SM:1-1:@VM:2
    CRT "Result of ANDS(A,B) is : " : ANDS(A,B)
* ACSCII
    OSREAD the_line FROM 'test.txt' ELSE NULL    
    CRT "ASCII representation is : " : ASCII(the_line)
* ASSIGNED
    var1 = "xyz"
    IF ASSIGNED(Var1) THEN
        CRT "Var1 has been assigned a value"
    END
* BITAND
    CRT "Result of BITAND(6,12) is " : BITAND(6,12)
* BITCHANGE
    CRT "Result of BITCHANGE(100) is " : BITCHANGE(100)
* BITCHECK
    CRT "Result of BITCHECK(100) is " : BITCHECK(100)
* BITLOAD
    TABLE.VALUE = BITLOAD()
    CRT "Content of TABLE.VALUE is : " : TABLE.VALUE
* BITNOT
    CRT "Result of BITNOT(6) is " : BITNOT(6)
* BITOR
    CRT "Result of BITOR(6,12) is " : BITOR(6,12)
* BITRESET
    CRT "Result of BITRESET(112) is " : BITRESET(112)
* BITSET
    CRT "Result of BITSET(112) is " : BITSET(112)
* BITTEST
    CRT "Result of BITTEST(11,0) is " : BITTEST(11,0)
* BITXOR
    CRT "Result of BITXOR(6,12) is " : BITXOR(6,12)
* BREAK
    V.ARRAY = ''
    FOR V.I = 1 TO 10
        IF V.I EQ 4 THEN BREAK
        V.ARRAY<-1> = V.I
    NEXT V.I
    CRT "V.ARRAY is : " : FMT(V.ARRAY, 'MCP') ;* 1^2^3
* BYTELEN
    V.UTF = 'ABCDEF' \
         : CHAR(353) : CHAR(352) : CHAR(269) : CHAR(268) : CHAR(263) \
         : CHAR(262) : CHAR(382) : CHAR(381) : CHAR(273) : CHAR(272)
    V.LEN = LEN(V.UTF)  ;  
    CRT "Length of V.LEN is " : V.LEN  ;* 16
    CRT "Byte count of V.LEN is " : BYTELEN(V.UTF)
*  CALL
    V.ARRAY = 1 :@FM: 2 :@FM: 3 :@FM: 4
    V.VAR = V.ARRAY<2>
    CALL NUM.INCR(V.VAR)
* CALLC
    A = 10; B = 1000
    MyFunction = "MYC1"
    CALLC @MyFunction
* CALLdotNET
    CALLdotNET 'myNameSpace.Class1', 'mymethod', p SETTING ret
    CRT "Result of call is : " : ret
* CALLJ
    CALLJ "mypackage.mytestclass","mymethod", p SETTING ret
    CRT "Result of call is : " : ret
* CALLONEXIT
    PROGRAM PROG1
    rc = CALLONEXIT('ErrorExit')
    EXECUTE "PROG2"
* CASE
    V.STRING = 'B'
    GOSUB CHK.IT
    STOP
CHK.IT:
*
    BEGIN CASE
    CASE V.STRING EQ 'A'
        CRT 'an A'
    CASE  V.STRING EQ 'B'
        CRT 'a B'
    CASE V.STRING EQ 'C'
        CRT 'a C'
    CASE @TRUE
        CRT 'neither A nor B nor C'
    END CASE
    RETURN
* CATS
    an_array = "a" : @VM : "b" : @VM : "c"    
    another_array = 1 : @VM : 2 : @VM : 3    
    the_result = CATS(an_array, another_array)    
    CRT "Result of CATS function is " : OCONV(the_result, 'MCP')
* CHAIN
    COMMON A,B
    A = 50 ; B = 100
    CHAIN "NEWPROG (I"
* CHANGE
    V.STRING = 'ABCDEFCDYZ'
    CHANGE 'QD' TO 'nnn' IN V.STRING
    CRT "Result of CHANGE is : " : V.STRING                 ;* ABnnnEFnnnYZ    
    * Compatibility mode
    V.STRING = CHANGE(V.STRING, 'YZ', '+-')
    CRT "Result of CHANGE() is : " :V.STRING                ;* ABnnnEFnnn+-
* CHANGETIMESTAMP
    curr_time = MAKETIMESTAMP(DATE(), TIME(), '')
    CRT "Current timestamp is : " : curr_time                                    ;*   e.g. 1358247401.205
    * Add 100 milliseconds
    adj_array = ''
    adj_array<8> = 100
    CRT "Changed timestamp is : " : CHANGETIMESTAMP(curr_time, adj_array) ;* 1358247401.305 for example above
* CHAR
    CRT "Hex of CHAR(353) is : " : OCONV( CHAR(353), 'MX' ) 
* CHARS
    V.ARRAY = 59 : @FM : 45 : @FM : 41
    V.CHARS = CHARS(V.ARRAY)
    CRT "Value of array is : " : CHANGE(V.CHARS, @FM, '')
* CHDIR
    IF CHDIR("/opt/jbase/CurrentBersion/samples") THEN
        CRT "jBASE coding samples are installed"
    END
* CHECKSUM
    CRT "CheckSum result is : " : CHECKSUM( CHAR(0) : '!' ) 
* CLEAR
    Var1 = 99
    Var2 = 50
    CLEAR
*  CLEARCOMMON
    COMMON / MY.COMM / global_var    
    COMMON gl_unnamed    
    global_var = 1000    
    gl_unnamed = 1001    
    CLEARCOMMON
* CLEARDATA
    DATA '123'    DATA '456'    
    CRT SYSTEM(14)                      ;*  8 (including 2 line end characters)    
    CLEARDATA
* CLEARFILE
    OPEN 'F.TEMP' TO F.TEMP THEN
        V.ERR = ''
        CLEARFILE F.TEMP SETTING V.ERR
    END
* CLEARINPUT
    CLEARINPUT
* CLEARSELECT
    A = "good" : @AM : "bad" : @AM : "ugly"
    B = "night" : @AM : "day"

    SELECT A TO 3
    SELECT B TO blist
    CLEARSELECT 3
* CLOSE
    OPEN 'F.TEMP' TO F.TEMP ELSE ABORT 201, 'F.TEMP'
    V.REC.INIT = 'LINE 1' :@FM: 'LINE 2' :@FM: 'LINE 3'
    WRITE V.REC.INIT TO F.TEMP, 'REC1'
    CLOSE F.TEMP
* CLOSESEQ
    CLOSESEQ FileVar
* COL1/COL2
    V.STRING = 'ABC/DEF/QWE/XYZ'
    *
    CRT "Field found : " : FIELD(V.STRING, '/', 2)               ;* DEF
    CRT "Content of COL1() : " : COL1()                          ;* 4 - position right before "DEF"
    CRT "Content of COL2() : " : COL2()                          ;* 8 
* COLLECTDATA
    COLLECTDATA PassedMessage
* COMMON
    COMMON /MY.COMM/ V.VAR1
* COMPARE
    A = "XY999"
    B = "XY1000"
    R1 = COMPARE(A, B, 'L')
* CONTINUE
    num_array = ''
    FOR i = 1 TO 10
        IF i EQ 3 THEN CONTINUE
        num_array<-1> = i
    NEXT i
* CONVERT()
    IF NOT(GETENV('JBCEMULATE', jbc_emu)) THEN
       the_string = 'ABCCCDEFCDYZ'
       IF jbc_emu = 'prime' THEN
          the_result = CONVERT('CEY', '+-*', the_string)
       END ELSE
          the_result = CONVERT(the_string, 'CEY', '+-*')
       END
    END
* CONVERT 
    Value = 'ABCDEFGHIJ'
    CONVERT 'BJE' TO '^+!' IN Value
* COS
    FOR I = 1 TO 360
        CRT COS(I) ;* print cos i for 1 to 360 degrees
    NEXT I
* COUNT
    Calc = "56 * 23 / 45 * 12"
    CRT "There are " : COUNT(Calc, '*') : " multiplications"
* COUNTS
    ARRAY= "A" :@VM: "AA" :@SM: "AAAAA"
    CRT "Result of COUNTS(ARRAY, 'AA') = " : COUNTS(ARRAY, 'AA')
* CREATE
    INCLUDE JBC.h
    out_dir = '.'  ;  out_file = 'report.txt'
    OPENSEQ out_dir, out_file TO f_out THEN
        WEOFSEQ f_out
    END ELSE
        CREATE f_out ELSE CRT 'File create error'  ;  STOP
        CRT 'File created'
    END
* CRT
    CRT @TERMTYPE
* DATA
    DATA '12345','67890'
    EXECUTE 'test2'
* DATE
    curr_date = DATE()
    CRT "Current date is " : OCONV(curr_date, 'D4/')    ;* e.g. 01/17/2013
* DCOUNT
    search_string = "A:B:C:D"
    CRT "The number of delimited strings is " : DCOUNT(search_string, ':')
* DEBUG
    DEBUG
* DECRYPT
    IF DECRYPT("rknzcyr","",1) = "example" THEN CRT "ROT13 ok"
* DEFC
    DEFC VAR MyString(VAR, VAR)
    DEFC INT MyCalc(INT, INT)
* DEFCE
    DEFCE INT getpid()
    CRT "Process id =" : getpid()
* DEFFUN
    DEFFUN Add()
    A = 10
    B = 20
    sum = Add(A, B)
*
    DEFFUN BITTEST(xbit, ybit)
* DEL
    Numbers = ''
    FOR I = 1 TO 20
        Numbers<I> = I   ;*generate numbers
    NEXT I
    FOR I = 19 TO 1 STEP -2
        DEL Numbers<I>   ;* remove odd numbers
    NEXT I
* DELETE
    OPEN "DAT1" TO DatFile1 ELSE ABORT 201, "DAT1"
    DELETE DatFile1, "record1"
* DELETELIST
    EXECUTE 'SELECT .' : @FM : 'SAVE-LIST FILES-LIST'
    DELETELIST 'FILES-LIST'
* DELETESEQ
    DELETESEQ '.', 'temp.txt' ELSE NULL
* DELETEU
    DELETEU DatFile1, "record2"
* DIMENSION
    DIMENSION NEW.V.ARRAY(10)
    DIM V.DIM3(2, 3, 4)
* DIR
    IF NOT( GETENV('JBCRELEASEDIR', V.HOME) ) THEN
          CRT 'JBCRELEASEDIR not defined!'
          STOP
       END
       CRT "Attributes of JBCRELEASEDIR are : " : OCONV( DIR(V.HOME), 'MCP' )
* DISPLAY
    DISPLAY "DISPLAY is a synonym for CRT"
* DIV
    CRT "Result of DIV(200, 400) is : " : DIV(200, 400) 
* DIVS
    A = 10 : @VM : 15 : @VM : 9 : @SM : 4
    B = 2 : @VM : 5 : @VM : 9 : @VM : 2
    CRT "Result of DIVS(A,B) is : " : DIVS(A,B)
* DOWNCASE
    V.VAR = "This is a TEST"
    CRT "The result of DOWNCASE(V.VAR) is : " : DOWNCASE(V.VAR)
* DQUOTE
    CRT "The result of DQUOTE(V.VAR) is : " : DQUOTE(V.VAR)
* DROUND
    V.PI = 3.14159265358979323846
    CRT 'Default rounding of PI is : ' : DROUND(V.PI)
* DTX
    Decimal = 254
    CRT "Result of DTX(Decimal) is : " : DTX(Decimal)
* DYNTOXML
    a = "Tom" : @AM : "Dick" : @AM : "Harry"
    CRT "Result of DYNTOXML(a, '', result) is : " : DYNTOXML(a, '', result)
* EBCDIC
    READT AsciiBlock ELSE CRT "Tape read failed!" ; STOP
    EbcdicBlock = EBCDIC(AsciiBlock) ;* Convert to EBCDIC
* ECHO
    ECHO OFF
    CRT "Enter your password " :
    INPUT Password
    ECHO ON
* ENCRYPT
    IF ENCRYPT('g{ehvkm', '9', JBASE_CRYPT_XOR11) = "example" THEN
        CRT "XOR.MOD11 ok"
    END
* END (see above!)
* ENTER
    ProgName = "UPDATE"
    ENTER @ProgName
* EQS
    A = 1 : @VM : 45 : @SM : 3 : @VM : "one"
    B = 0 : @VM : 45 : @VM : 1
    CRT "Result of EQS(A,B) is : " : EQS(A,B)
* EQUATE
    EQUATE DASHES TO "-------"
* EREPLACE
    A = "AAABBBCCCDDDBBB"
    CRT "The result of EREPLACE(A,'BBB', 'ZZZ') is : " : EREPLACE(A,'BBB', 'ZZZ')
* EXECUTE
    EXECUTE "ls" CAPTURING DirListing
* EXIT
    READ Record FROM FileDesc, RecordKey ELSE
        CRT "Record " : RecordKey : " is missing"
        EXIT(1)
    END ELSE
        CRT "All required records are present"
        EXIT(0)
    END
* EXP
    CRT "Result of EXP(10) is : " : EXP(10)
* EXTRACT
    array = "0"    ;    array<2> = "1" ;  array<2,2> = 'Text' ;  array<3> = "2"
    CRT "Result of DQUOTE( OCONV( EXTRACT(array, 2), 'MCP' ) ) is : " : DQUOTE( OCONV( EXTRACT(array, 2), 'MCP' ) )   ;*    "1]Text"
* FADD
    PRECISION 7
    CRT "Result of FADD(0.5044,23.7290002) is : " : FADD(0.5044,23.7290002)
* FDIV
    CRT "The result of FDIV(1, 7)  is " : FDIV(1, 7)
* FIELD
    V.STRING = 'ABC/DEF/QWE/XYZ'
    CRT "The second field in the string is : " : FIELD(V.STRING, '/', 2)
* FIELDS
    t = ""
    t<1> = "a:b:c:d:e:f"
    t<2> = "aa:bb:cc:dd:ee:ff" : @VM: "1:2:3:4" : @SM: ":W:X:Y:Z"
    t<3> = "aaa:bbb:ccc:ddd:eee:fff" :@VM:@SM
    t<4> = "aaaa:bbbb:cccc:dddd:eeee:ffff"
    CRT "Result of FIELDS(t,':',2) is : " : FIELDS(t,':',2)
* FILEINFO
    IF NOT( GETENV('JBCRELEASEDIR', jbase_home) ) THEN
        CRT 'JBCRELEASEDIR not defined'
        STOP
    END
//
    log_dir = jbase_home : '/tmp'
    log_file = 'jbase_error_trace'
//
    OPENSEQ log_dir, log_file READONLY TO f_log THEN
        CRT "File information on 'jbase_error_trace' : " : FMT( FILEINFO(f_log, 1), 'MCP' )
    END ELSE
        CRT 'jbase_error_trace not found'
    END
* FILELOCK
    OPEN '','SLIPPERS' TO F.FILEVAR ELSE STOP "CAN'T OPEN FILE"
    FILELOCK F.FILEVAR LOCKED STOP 'FILE IS ALREADY LOCKED'
* FILEUNLOCK
    FILEUNLOCK F.FILEVAR
* FIND
    V.ARRAY = 'ABC'   \
           :@FM: 'DEF' :@VM: '123' :@VM: 'XYZ' :@VM: '456' \
           :@FM: '789' \
           :@FM: '---' : @SM: 'XYZ'
    GOSUB RESET.IT
    FIND 'XYZ' IN V.ARRAY SETTING V.FLD, V.VAL ELSE NULL
    CRT "Result of FIND on 'XYZ' is " : V.FLD, V.VAL            ;*   2       3
* FINDSTR
    GOSUB RESET.IT
    FINDSTR 'XY' IN V.ARRAY SETTING V.FLD, V.VAL ELSE NULL
    CRT "Result of FINDSTR on 'XY' is " : V.FLD, V.VAL
* FLUSH
    dir_name = '.'
    file_name = 'report.txt'
    DELETESEQ dir_name, file_name ELSE NULL
*
    OPENSEQ dir_name, file_name TO f_report ELSE NULL
    WRITESEQ 'New data' TO f_report ELSE NULL
*
    FLUSH f_report ELSE NULL
* FMT
    X = 1234.56
    CRT "Formatted output for 'X' is : " : DQUOTE( FMT(X, 'R2#10') )    
* FMTS
    X = 1234.56 :@FM: 123456.78 :@FM: -123456.78 :@FM: 1234567890
    CRT CRT "Formatted output for array 'X' is : " :OCONV( FMTS(X, 'R2*12'), 'MCP' )
* FMUL
    CRT "The result of FMUL(2.54, 5.703358) is : " : FMUL(2.54, 5.703358)    ;* 14.48652932
* FOLD
    V.STRING = "Hello world"
    CRT "The folded version of variable 'V.STRING' looks like this : " : OCONV( FOLD(V.STRING, 5), 'MCP' )
* FOOTING
    FOOTING "This is the end"
* FOR
    V.ARRAY = ''
    FOR V.I = 1 TO 10
        V.ARRAY<-1> = 'Element #' : V.I
    NEXT V.I
* FORMLIST
    MyList = "key1":@AM:"key2":@AM:"key3"
    FORMLIST MyList TO ListVar
* FSUB
    PRECISION 7
    CRT "Result of FSUB(2.54, 5.703358) is : " : FSUB(2.54, 5.703358)
* FUNCTION
*
* GES
    A1 = "a" : @AM : 50 : @SVM: "$" : @VM : 4 : @VM
    A2 = "b" : @AM : 20 : @SVM: "%" : @VM : 4
    CRT "The result of GES(A1, A2) is : " : GES(A1, A2)
* GET
*
* No example code
*
* GETCWD
    IF GETCWD(Cwd) THEN
       CRT "Current Working Directory = " : Cwd
    END ELSE
       CRT "Could not determine CWD!"
    END
* GETENV
    IF GETENV('PATH', ExecPath) THEN
        CRT "Execution path is " : ExecPath
    END ELSE
        CRT "Execution path is not set up"
    END
* GETLIST
    EXECUTE 'SELECT . SAMPLE 5' :@FM: 'SAVE-LIST FILES-LIST'
    GETLIST 'FILES-LIST' TO V.FILES.L ELSE
        CRT 'GETLIST error'
        STOP
    END
* GETX
*
* No example code
*
* GOSUB
    GOSUB RESET.IT
* GOTO
    GOTO Exception
* GROUP
    A = "123:-456:-789:-987:-"
    CRT "The result of GROUP(A, ':-', 2, 2) is : " : GROUP(A, ':-', 2, 2)
* GROUPSTORE
    to.var = 'QQQ' :@FM: 'WWW' :@FM: 'EEE'
    from.var = 'rtz'
    GROUPSTORE from.var IN to.var USING 2, 0, @FM   ;* start,replace,delim
    CRT "Result of GROUPSTORE is : " : FMT(to.var, 'MCP') 
* HEADING
    HEADING "This is the beginning"
* HEADINGE
    HEADINGE "This is a new beginning"
* HEADINGN
    HEADINGN "This is another beginning"
* HUSH
    HUSH OFF
* ICONV
    zeroDate = ICONV("31 DEC 1967", "D4") 
* ICONVS
*
* No example code
*
* IF
    IF A THEN A = A + 1
* IFS
*
* No example code
*
* IN
    IN Char
* INCLUDE
    INCLUDE JBC.h
* INDEX
    alphabet = "abcdefghijklmnopqrstuvwxyzabc"
    CRT "Result of INDEX(ABet, 'jkl', 1) is : " : INDEX(ABet, 'jkl', 1)
* INDICES
    filename = "CUSTOMERS"
    OPEN filename TO filevar ELSE STOP 201,filename
    index.list = INDICES(filevar)
* INMAT
    DIM cust_rec(99)
    MAT cust_rec = ''
    CRT "Result of INMAT(cust_rec) is : " : INMAT(cust_rec)  
* INPUT
    Answer = ''
    LOOP
    WHILE Answer = '' DO
        INPUT Answer,1 FOR 10 ELSE
            GOSUB UpdateClock
        END
    REPEAT
* INPUTCLEAR
    INPUTCLEAR
* INPUTNULL
    INPUTNULL "&"
* INS
    Values = ''
    FOR I = 1 TO 50
        INS I BEFORE Values<-1>
    NEXT I
* INSERT
    B = 'Field 1' :@VM: 2 :@VM: 3 :@VM: 5 :@FM: 'Field 2'
    A = INSERT(B, 1, 4; 'Field1Value4')
    CRT "Result of the INSERT fucntion is : " : OCONV(A, 'MCP')
* INT
    CRT "Result of INT(22/7) is : " : INT(22/7)     
* IOCTL
    OPEN "CUSTOMERS" TO DSCB ELSE STOP 201,"CUSTOMERS"
    filename = ""
    IF IOCTL(DSCB,JBC_COMMAND_GETFILENAME,filename) ELSE
        CRT "IOCTL failed !!" ; EXIT(2)
    END
    CRT "Full file path = ": DQUOTE(filename)
* ISALPHA / ISALNUM
    V.STRING = 'AWERC'
* check if there are only alphabetic characters
    CRT ISALPHA(V.STRING)             ;* 1
* add number to the end
    V.STRING := 1   ; CRT V.STRING    ;* AWERC1
* check again if there are only alphabetic characters
    CRT ISALPHA(V.STRING)             ;* 0
* check if there are only alphanumeric characters
    CRT ISALNUM(V.STRING)             ;* 1
* ISCNTRL
* ISDIGIT
* ISLOWER
    V.STRING = "SLIPPERS"
    CRT "The result of 'ISLOWER()' on the string is : " : ISLOWER(V.STRING)
* ISPRINT
* ISSPACE
* ISUPPER
* ITYPE
*
* Data preparation
    V.FILE = "SLIPPERS"
    EXECUTE "DELETE-FILE " : V.FILE
    EXECUTE "CREATE-FILE " : V.FILE
    OPEN V.FILE TO F.TEMP ELSE ABORT 201, "F.TEMP"
    OPEN "DICT", V.FILE TO F.TEMP.DICT ELSE ABORT 201, "F.TEMP]D"
* Field 1 dictionary entry
    R.DICT.D1 = ""
    R.DICT.D1<1> = "D"
    R.DICT.D1<2> = "1"
    R.DICT.D1<5> = "25L"
    R.DICT.D1<6> = "S"
    WRITE R.DICT.D1 TO F.TEMP.DICT, "FOOTWEAR"
* I-descriptor
    V.DESCR = "SIZE"
    R.DICT.I = ""
    R.DICT.I<1> = "I"
    R.DICT.I<2> = 'FOOTWEAR[":", 2, 1]'
    R.DICT.I<4> = V.DESCR
    R.DICT.I<5> = "3R"
    R.DICT.I<6> = "S"
    WRITE R.DICT.I TO F.TEMP.DICT, V.DESCR
* Data records
    R.DATA = ""
    R.DATA<1> = "Slippers:8"
    WRITE R.DATA TO F.TEMP, "Jim"
    R.DATA = ""
    R.DATA<1> = "Boots:10"
    WRITE R.DATA TO F.TEMP, "Greg"
    R.DATA = ""
    R.DATA<1> = "Slippers:5"
    WRITE R.DATA TO F.TEMP, "Alan"
* Data is prepared; now process it
    @FILENAME = V.FILE
    READ V.ITYPE FROM F.TEMP.DICT, V.DESCR ELSE ABORT
*
    SSELECT F.TEMP TO V.PEOPLE.L
    LOOP
        READNEXT V.ID FROM V.PEOPLE.L ELSE BREAK
        @ID = V.ID
        READ @RECORD FROM F.TEMP, @ID ELSE ABORT
        V.RET = ITYPE(V.ITYPE)
        CRT @ID : "'s footwear has size " : V.RET
    REPEAT
* JBASECOREDUMP
    rc = JBASECOREDUMP('', 0)
* JBASETHREADCreate
* JBASETHREADStatus
* JQLCOMPILE
* JQLEXECUTE
* JQLFETCH
* JQLGETPROPERTY
* JQLPUTPROPERTY
* KEYIN
    V.KEY = UPCASE( KEYIN() )
* LATIN1
    utf_line = CHAR( XTD('C3') ) : CHAR( XTD('9F') ) : CHAR( XTD('C3') ) : CHAR( XTD('9D') )    ;* c3 9f: LATIN SMALL LETTER SHARP S,  c3 9d: LATIN CAPITAL LETTER Y WITH ACUTE
    lat_line = LATIN1(utf_line)
    CRT "Latin equivalent is " : lat_line
* LEFT
    S = "The world is my lobster"
    CRT "The LEFT part of the string is : " : DQUOTE( LEFT(S,9) )
* LEN
    V.STRING = "I am a string of characters"
    CRT "String length is : " : LEN(V.STRING)
* LENDP
    CRT "Display length of our UTF-8 string is : " : LENDP(utf_line)
* LENS
* LES
* LN
    CRT "The result of LN(22 / 7) is : " : LN(22 / 7)
* LOCALDATE
    start_time = MAKETIMESTAMP(DATE(), TIME(), '')    
    time_shift = 100 ; time_shift<8> = ''      ;* add 100 years to current date    
    end_time = CHANGETIMESTAMP(start_time, time_shift)    
    CRT "Time shifted local date is : " : OCONV( LOCALDATE(end_time, '') , 'D')                 ;* e.g. 13 DEC 2119
* LOCALTIME
* LOCATE
    V.ARR = ''
    FOR V.I = 1 TO 1000
      V.ARR<V.I> = RND(1000)
    NEXT V.I
    V.SORTED = ''
    FOR V.I = 1 TO 1000
        V.IN = V.ARR<V.I>
        LOCATE V.IN IN V.SORTED<1> BY 'AN' SETTING V.INS.POSN ELSE NULL
        INS V.IN BEFORE V.SORTED<V.INS.POSN>
    NEXT V.I
    CRT "Minimum and maximum values are ": MINIMUM(V.ARR), MAXIMUM(V.ARR)  ;* e.g. "0       998"
    CRT "Fist and last numbers are : " : V.SORTED<1>, V.SORTED<1000>     ;* numbers should be the same as above
* LOCK
    LOCK 32 ELSE
        CRT "This program is already executing!"
        STOP
    END
*  LOOP
    EXECUTE 'SELECT ' : jbase_home : '/jbcmessages SAMPLE 10' RTNLIST V.MSG.L
    * Retrieve @IDs one by one
    LOOP
        REMOVE V.ID FROM V.MSG.L SETTING V.STATUS
    UNTIL V.STATUS = 0 DO
        CRT V.ID
    REPEAT
* LOWCASE
    V.VAR = "This is another TEST"
    CRT "The result of LOWCASE(V.VAR) is : " : LOWCASE(V.VAR)
* LOWER
    V.ARRAY = 1 : @FM : 2 : @FM : 3 : @FM : 4
    CRT "The LOWER'ed array is : " : OCONV( LOWER(V.ARRAY), 'MCP' )             ;*  1]2]3]4
* MAKETIMESTAMP
    CRT "London's timestamp in UTC format is " : MAKETIMESTAMP( DATE(), TIME(), 'Europe/London')   ;* e.g. 1352113823.755
* MAT
    DIM A(33), G(33)
    MAT G = "Array value"
    MAT A = MAT G
* MATBUILD
    DIM A(40)
    MAT A = 'Value '
    FOR V.I = 1 TO 40
        A(V.I) := V.I
    NEXT V.I
    MATBUILD Dynamic FROM A, 3, 7 USING ":"
    CRT "Content of Dynamic is : " : Dynamic
* MATCH
* MATCHES
    start_date = '2011-10-25'
    rc = start_date MATCHES "4N'-'2N'-'2N" 
    CRT "Check start_date is the correct format : " : rc
* MATCHFIELD
    Q = MATCHFIELD("AA123BBB9","2A0N3A0N",3)
    CRT "Q = ", Q
* MATPARSE
    DIM dim_array(100)
    dyn_array = ''   ;     delim_array = ''
    FOR i = 1 TO 100
        dyn_array<-1> = i
        delim_array := i*2 : '-'
    NEXT i
    * Full copy
    MATPARSE dim_array FROM dyn_array
* MATREAD
    MATREAD dim_array FROM F.FILEVAR SETTING val ON ERROR
        CRT "Error number " : val : " occurred when reading record."
        STOP
    END THEN
        CRT 'Record read successfully'
    END ELSE
        CRT 'Record not on file'
    END
* MATREADU
* MATWRITE
    MATWRITE dim_array ON F.FILEVAR SETTING ErrorCode ON ERROR
        CRT "Error number " : val : " occurred while writing record."
    END
* MATWRITEU
* MAXIMUM
* MINIMUM
* MOD
    FOR I = 1 TO 10000
       IF MOD(I, 1000) = 0 THEN CRT "+" :
    NEXT I
* MODS
    dyn_a = 3 :@VM: 7
    dyn_b = 2: @SM: 7 :@VM: 4
    CRT "Result of MODS(dyn_a, dyn_b) is : " : OCONV( MODS(dyn_a, dyn_b), 'MCP' )       ;*  1\0]3
* MSLEEP
    MSLEEP(3000)
* MULS
    dyn_a = 1 :@VM: 2 :@VM: 3 :@SM: 4
    dyn_b = 4 :@VM: 5 :@VM: 6 :@VM: 9
    CRT "Result of MULS(dyn_a, dyn_b) is : " : OCONV( MULS(dyn_a, dyn_b), 'MCP' )       ;*  4]10]18\0]0
* NEG
    CRT "Result of NEG(100) is : " : NEG(100)
* NEGS
    dyn_array = 1 :@FM: 2 :@VM :3
    CRT "Result of NEGS(dyn_array) is : " : FMT( NEGS(dyn_array), 'MCP' )
* NES
* NEXT
* NOBUF
    OPENSEQ '.', 'test.txt' TO V.FILE THEN NOBUF V.FILE
* NOT
    EQU Sunday TO NOT( MOD( DATE(), 7))
    IF Sunday THEN
       CRT "It is Sunday today!"
    END
* NOTS
* NULL
    LOCATE A IN B SETTING C ELSE NULL
* NUM
    CRT "Result of NUM('6.02e23') is : " : NUM('6.02e23')
* NUMS
* OBJEXCALLBACK
    param1 = "SomeActionCode"
    param2 = ProblemItem
    OBJEXCALLBACK param1, param2 THEN
    * this routine was called from ObjEX
    END ELSE
    * this routine was not called from ObjEX
    END
* OCONV
    CRT "Today's date is : " : OCONV( DATE(), 'D4/' )
* OCONVS
* ON GOTO
* ON GOSUB
* OPEN
    OPEN 'F.TEMP' TO F.TEMP ELSE ABORT 201, 'F.TEMP'
* OPENDEV
    OPENDEV "\\.\TAPE0" TO tape.drive ELSE STOP
* OPENINDEX
    OPENINDEX "CUSTOMER","IXLASTNAME" TO custlastname.ix SETTING errval ELSE
        CRT "OPENINDEX failed for file CUSTOMER, index IXLASTNAME"
        ABORT
    END
* OPENPATH
    OPENPATH "F:\Users\data\CUSTOMERS" TO F.Customers ELSE STOP 201, "CUSTOMERS"
* OPENSEQ
    out_dir = '.'  ;  out_file = 'report.txt'
    OPENSEQ out_dir, out_file TO f_out THEN
        WEOFSEQ f_out
    END ELSE
        CREATE f_out ELSE CRT 'File create error'  ;  STOP
        CRT 'File created'
    END
* OPENSER
    FileName = "/dev/pts/1"
    OPENSER FileName TO File ELSE STOP 201, FileName
* ORS
    A = "A" :@SM: 0 :@VM: 4 :@SM: 1
    B = 0 :@SM: 1-1 :@VM :2
    CRT "The result of ORS(A, B) is : " : OCONV( ORS(A, B), 'MCP')
* OSOPEN / OSBREAD
    OSOPEN 'NEW.SYNTAX.TEST.b' TO myBasicFile ELSE STOP
    OSBREAD Source FROM myBasicFile 0 LENGTH 32000
    CRT Source
* OSBWRITE
    OSBWRITE Source ON myBasicFile AT 0
* OSBCLOSE
    OSBCLOSE myBasicFile
* OSDELETE
* OSREAD
* OSWRITE
* OUT
    FOR I = 32 TO 127; OUT I; NEXT I ;* Printable chars
* PAGE
* PAUSE
    PAUSE 20
* PERFORM
    PERFORM "ls" CAPTURING DirListing
* PRECISION
    PRECISION 8
* PRINT
* PRINTER
    PRINTER ON
    PRINTER OFF
* PRINTERR
    PRINTERR 201 : CHAR(254) : "CUSTOMERS"
* PROCREAD
    PROCREAD Primary ELSE
        CRT "Unable to read the jCL buffer"
        STOP
    END
* PROCWRITE
    PROCWRITE "Success" : CHAR(254) : "0"
* PROGRAM (See line 1)
* PROMPT
    PROMPT ":"
* PUTENV
    V.ENV = 'JBASE_ERRMSG_ZERO_USED'
    IF NOT( PUTENV(V.ENV : '=35') ) THEN
        CRT 'PUTENV failed'
        STOP
    END
* PWR
    CRT "The result of PWR(A, B) is : " : PWR(A, B)
* QUOTE
    CRT "The result of QUOTE(V.VAR) is : " : QUOTE(V.VAR)
* RAISE
    V.ARRAY = 1 :@TM: 2 :@SM: 3 :@VM: 4
    CRT "The initial array is : " : OCONV( V.ARRAY, 'MCP' )                      ;*  1.2\3]4
    CRT "The 'raised array is : " : OCONV( RAISE(V.ARRAY), 'MCP' )               ;*  1\2]3^4
* READ
    OPEN jbase_home : '/jbcmessages' TO F.MSG ELSE ABORT 201, 'jbcmessages'
    READ R.MSG FROM F.MSG, 'ARRAY_ILLEGAL_SIZE' ELSE
        CRT 'Error reading the file, ID=ARRAY_ILLEGAL_SIZE'
        STOP
    END
*  READBLK
    V.FILE.IN = 'RELEASE'
    V.FILE.INFO = DIR(jbase_home : '/' : V.FILE.IN)
    V.SIZE = V.FILE.INFO<1>
    OPENSEQ V.HOME, V.FILE.IN TO F.FILE.IN ELSE
        CRT 'Failed to open', V.FILE.IN
        STOP
    END
    V.BLK.SIZE = MINIMUM(V.SIZE : @FM : 512)
    READBLK V.TEXT FROM F.FILE.IN, V.BLK.SIZE ELSE
        CRT 'Failed to read', V.FILE.IN
        STOP
    END
    CRT "jBASE Release info : " : V.TEXT[1, INDEX(V.TEXT, CHAR(10), 1)]
* READL
    OPEN 'F.TEMP' TO f_temp ELSE
        EXECUTE 'CREATE-FILE DATA F.TEMP'
        OPEN 'F.TEMP' TO f_temp ELSE
            CRT 'OPEN FAILED'
            STOP
        END
    END
    rec_id = 'REC1'
    READL record FROM f_temp, rec_id LOCKED
        CRT 'Lock failure'
        STOP
    END ELSE NULL
    CRT "Record lock status is : " : RECORDLOCKED(f_temp, rec_id)  ;* 2 under Windows, 1 under Unix
* READLIST
    READLIST MyList FROM "MyList" ELSE STOP
* READNEXT
    V.SEL = 'SSELECT F.TEMP TO 9'
    EXECUTE V.SEL
    READNEXT V.ID FROM 9 ELSE CRT 'Readnext of REC1 failed'
* READNEXT KEY
    SELECT index.var
    * Read in each index record at a time.
    LOOP WHILE READNEXT KEY index.key, record.key, mv.key DO
        CRT "Index values are : " : index.key,record.key,mv.key
    REPEAT
* READPREV
    READPREV KEY index.key, record.key, mv.key ELSE CRT 'Readprev of REC1 failed'
* READSEQ
    OPENSEQ '.', 'test.txt' TO F.IN.FILE THEN
        READSEQ V.LINE FROM F.IN.FILE ELSE
            CRT 'Error reading file'
            STOP
        END
    END
* READT
    LOOP
    	READT TapeRec FROM 5 ELSE
        	Reason = SYSTEM(0)
        	IF Reason = 2 THEN BREAK ;* done
        	CRT "Tape error"  ;  STOP
    	END
    REPEAT
* READU
    READU V.REC FROM F.TEMP, 'REC1' LOCKED
        CRT 'Lock failure'
        STOP
    END ELSE NULL
* READV
    READV second_field FROM F.TEMP, 'REC1', 2 ELSE
        CRT 'Read error'
        STOP
    END
* READVU
    OPEN "DICT Customers" TO DCusts THEN
        LOOP
            READVU Rec FROM DCusts, "Xref",7 LOCKED
                CRT "Locked - retrying"
                SLEEP 1; CONTINUE ;* Restart LOOP
            END THEN
                READ DataRec FROM Rec ELSE
                    ABORT 202, Rec
                END
                BREAK ;*leave the LOOP
            END ELSE
                ABORT 202, "Xref"
            END
        REPEAT
    END
* READXML
* RECORDLOCKED (See READL)
* REGEXP
    String = "jBASE Software Inc."    ;* 4 (position of matching pattern -
    CRT "Result of REGEXP(String, 'S[^t]*') is : " : REGEXP(String, 'S[^t]*')      ;*   "S" followed by "t" later on)
* RELEASE
    RELEASE F.TEMP, 'REC1'
* REMOVE
    rec = "Field 1" : @FM : "Field 2" : @SM : " Sub-value" : @VM : "Value"
    REMOVE exString FROM rec SETTING V.STATUS
* REPLACE
    X = "jBASE" : @VM : "is" : @VM : "great" : @FM : '!'
    Y = REPLACE(X, 1, 2; 'is really')
* RETURN
* REWIND
    REWIND ON 5 ELSE NULL
* RIGHT
    S = "The world is my lobster"
    CRT "Result of RIGHT(S,7) is : " : DQUOTE( RIGHT(S,7))
* RND
    FOR I=1 TO 20
       CRT RND(100) : ", " :
    NEXT I
* RQM
    RQM 40
* RTNDATA
    RTNDATA garbage
* SADD
    A = 4000000000000000000000000000000
    B = 7
    CRT "Result of SADD(A,B) is : " : SADD(A,B)
* SDIV
    A = 2
    B = 3
    CRT "result of SDIV(A,B) is : " : SDIV(A,B)
* SEEK
    V.DIR.OUT = '.'  ;   V.FILE.OUT = 'report.txt'
    OPENSEQ V.DIR.OUT, V.FILE.OUT TO F.FILE.OUT THEN
        WEOFSEQ F.FILE.OUT
    END ELSE
        CREATE F.FILE.OUT ELSE CRT 'File create error'  ;  STOP
    END
    WRITESEQ '1234567890ABCDEF' TO F.FILE.OUT ELSE
        CRT 'Write error'
        STOP
    END
    *
    SEEK F.FILE.OUT, 5, 0 ELSE CRT 'Seek error'  ;  STOP
* SELECT
    OPEN "Customers" TO CustFvar ELSE ABORT 201, "Customers"
    SELECT CustFvar TO 2
* SELECTE / SELECTN / SELECTV
    SELECTE TO 0
    SELECTN CustFvar TO 5
    SELECTV CustFvar TO CustList
* SEND / SENDX
* SENTENCE
    ProgName = SENTENCE(0) ;* program is?
* SEQ
    CRT "Result of SEQ( ICONV('C5A1', 'MX') ) is : " : SEQ( ICONV('C5A1', 'MX') )
* SEQS
    G = "T" : @VM : "G"
    CRT "Result of SEQS(G) is : " :  SEQS(G)
* SIN
    CRT @(-1):
    FOR I = 0 TO 79
        CRT @(I,12 + INT( SIN (360/80 * (I + 1) ) * 10 )) : "*" :
    NEXT I
* SLEEP
    SLEEP 40
* SMUL
    A = 243603310027840922
    B = 3760
    CRT "Result of SMUL(A,B) is : " : SMUL(A,B)
* SORT
    MyArray = 'George' : @VM : 'Fred' : @AM : 'John' : @SM : 'Andy'
    CRT "Result of SORT(MyArray) is : " : OCONV( SORT(MyArray), 'MCP')
* SOUNDEX
    INPUT Lastname
    CRT "The Result of SOUNDEX(Lastname) is " : SOUNDEX(Lastname)
* SPACE
    TenSpaces = SPACE(10)
* SPACES
* SPLICE
    A = "A" :@VM: "B" :@SM: "C"
    B = "D" :@SM: "E" :@VM: "F"
    C = '-'
    CRT "The result of SPLICE(A,C,B) is : " : SPLICE(A,C,B)
* SPOOLER
* SQRT
* SSELECT / SSELECTN / SSELECTV
    SSELECT F.TEMP TO V.LIST
*
    init_array = 3 : @VM : 'Third row'
    init_array<-1> = 2 : @VM : 'Second row'
    init_array<-1> = 4 : @VM : 'Fourth row'
    init_array<-1> = 1 : @VM : 'First row'
    SSELECTV init_array TO sorted_array
* SSUB
    A = 2.3000000123456789
    B = 5.0000000000000001
    CRT "The result of SSUB(A,B) is : " : SSUB(A,B)
* STATUS
    STATUS()
*
    IF ( GETENV('JEDIFILENAME_SYSTEM', FN.SYSTEM) ) THEN
       OPEN FN.SYSTEM TO F.SYSTEM ELSE NULL
       STATUS V.INFO.L FROM F.SYSTEM ELSE ABORT
       CRT "Permissions : " : V.INFO.L<5>       ;*  permissions in octal, e.g. 655
       CRT "File size   : " : V.INFO.L<6>       ;*  file size in bytes
       CRT "Full path   : " : V.INFO.L<20>      ;*  full path to file
       CRT "File type   : " : V.INFO.L<21>      ;*  file type, e.g. J4, JR, XMLDB2, SEQ
    END
* STOP
    GOSUB Exception
* STR
    Tenspaces = STR(" ", 10)
* STRS
* SUBROUTINE
* SUBS
* SUBSTRINGS
    t = ""
    t<1> = "AAAAA"
    t<2> = "BBBBB" :@VM: "CCCCC" : @SM: "DDDDD"
    t<3> = "EEEEE" :@VM: @SM
    CRT "Result of SUBSTRINGS(t,4,20) is : " : SUBSTRINGS(t,4,20)
* SUM
    V.ARRAY = 1 :@FM: 2 :@FM: 3.1
    CRT "Result of SUM(V.ARRAY) is : " : FMT( SUM(V.ARRAY), 'MCP' )   
* SWAP
    V.STRING = 'ABCDEFCDYZ'
    SWAP 'QD' TO 'nnn' IN V.STRING
    CRT "Result of SWAP is : " : V.STRING                 ;* ABnnnEFnnnYZ    
* SYSTEM
* TAN
    Adjacent = 42
    Angle = 34
    CRT "Opposite length = " : TAN (Angle) * Adjacent
* TIME
    CRT "The current time is " : OCONV( TIME(), "MTS" )
* TIMEDATE
    CRT "The current time and date is " : TIMEDATE()
* TIMEDIFF
* TIMEOUT
    TIMEOUT SLIPPERS, 10
* TIMESTAMP
* TRANS
    VENDOR.ID = "12345"
    VENDOR.NAME = TRANS('VENDORS', VENDOR.ID, 1 , 'X')
    CRT "Vendor name for ID = 123455 is : " : VENDOR.NAME
* TRANSABORT / TRANSEND / TRANSQUERY / TRANSTART
* TRIM / TRIMB / TRIMBS / TRIMF / TRIMFS
* UNASSIGNED
    IF UNASSIGNED(String1) THEN String1 = "Now assigned!"
* UNIQUEKEY
    CRT "Result of UNIQUEKEY() is : " : FMT( DOWNCASE( FMT( UNIQUEKEY(), 'MX')), 'L(########-####-####-############)')
* UNLOCK
    LOCK 35 ; UNLOCK
* UPCASE
    V.VAR = "This is a test"
    CRT "The result of UPCASE(V.VAR) is : " : UPCASE(V.VAR)
* UTF8
    lat_line = CHAR(198) : CHAR(189) : CHAR(191)
    utf_line = UTF8(lat_line)
    CRT "UTF8 equivalent is " : utf_line
* WAKE
* WEOF
    WEOF ON 5 ELSE
        CRT "No tape device exists for channel 5"
    END
* WEOFSEQ
    WEOFSEQ f.out
* WRITE
    V.REC.INIT = 'Attr 1' :@FM: 'Attr 2' :@FM: 'Attr 3'
    WRITE V.REC.INIT TO F.TEMP, 'REC1'
* WRITEBLK
    OPENSEQ '.', V.ID TO  F.FILE.OUT THEN
        WEOFSEQ F.FILE.OUT  ;* truncate the file
    END ELSE  ;* will have to create - WRITEBLK wouldn't do that
        CREATE F.FILE.OUT THEN
            CRT 'File creation failure'
            STOP
        END
    END
    V.BUFFER = 'Line 1' : CHAR(10) : 'Line 2' : CHAR(10) : 'Line 3'
    WRITEBLK V.BUFFER TO F.FILE.OUT ELSE
        CRT 'Write error'
        STOP
    END
* WRITELIST
    EXECUTE 'SELECT . SAMPLE 5' RTNLIST V.LIST
    WRITELIST V.LIST TO 'Some-Files'
* WRITESEQ
    V.ID = 'report.txt'
    OPENSEQ '.', V.ID TO F.FILE.OUT THEN
        WEOFSEQ F.FILE.OUT  ;* truncate the file
    END
    WRITESEQ 'Line 1' TO F.FILE.OUT ELSE
        CRT 'Write error'
        STOP
    END
    CRT 'File ' : V.ID :  ' written'
    CLOSESEQ F.FILE.OUT
* WRITESEQF
* WRITET
    LOOP
        WRITET TapeRec ON 5 ELSE
            Reason = SYSTEM(0)
            IF Reason = 2 THEN BREAK ;* done
            CRT "ERROR"  ;  STOP
        END
    REPEAT
* WRITEU
    OPEN 'F.TEMP' TO F.TEMP ELSE
        EXECUTE 'CREATE-FILE DATA F.TEMP'
        OPEN 'F.TEMP' TO F.TEMP ELSE
            CRT 'Open failed'
            STOP
        END
    END
    READU V.REC FROM F.TEMP, 'REC1' LOCKED
        CRT 'Lock failure'
        STOP
    END ELSE NULL
    V.REC<-1> = 'A field'
    CRT RECORDLOCKED(F.TEMP, 'REC1')  ;* 2 - "Locked by this process by a READU"
    WRITEU V.REC TO F.TEMP, 'REC1'
* WRITEV
    EXECUTE 'DELETE-FILE DATA F.TEMP'    EXECUTE 'CREATE-FILE DATA F.TEMP'    
    OPEN 'F.TEMP' TO f_temp ELSE ABORT 201, 'F.TEMP'    
    new_rec = 'Line 1' : @FM : 'Line 2' : @FM : 'Line 3'    
    WRITE new_rec TO f_temp, 'REC1'    
    WRITEV 'LINE 2v2' TO f_temp, 'REC1', 2 ON ERROR       
        CRT 'WRITEV error'       
        STOP   
    END
* WRITEVU
    OPEN "Customers" ELSE ABORT 201, "Customers"
    OPEN "DICT Customers" TO DCusts ELSE
       ABORT 201, "DICT Customers"
    END
    WRITEVU Rec ON DCusts, 'Xref', 1 SETTING Err ON ERROR
       CRT "I/O Error [" : Err : "] occurred"
       ABORT
    END
* WRITEXML
* XLATE
    VENDOR.ID = "12345"
    VENDOR.NAME = XLATE('VENDORS', VENDOR.ID, 1 , 'X')
    CRT "Vendor name for ID = 123455 is : " : VENDOR.NAME
* XMLTODYN
* XMLTOXML
* XTD
    A = "FF"
    CRT "Decimal equivalent of 'FF' is : " : XTD(A)
RESET.IT:
    V.FLD = 0  ; V.VAL = 0  ;  V.SVAL = 0
    RETURN
*
UpdateClock:
    RETURN
Exception:
    STOP
END
