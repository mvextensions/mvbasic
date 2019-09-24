    program syntax.test
*
    include pgm line1
    $include pgm line2
    insert pgm line3
    $insert pgm line4
* 
    open "","testfile" to f.test else stop 201, "testfile"
*
    crt
    crt "@account        = " : @account
    crt "@am             = " : @am
    crt "@application.id = " : @application.id
    crt "@callstack      = " : @callstack
    crt "@codepage       = " : @codepage
    crt "@command        = " : @command
    crt "@data           = " : @data
    crt "@date           = " : @date
    crt "@day            = " : @day
    crt "@eof            = " : @eof
    crt "@esc            = " : @esc
    crt "@false          = " : @false
    crt "@filename       = " : @filename
    crt "@ff             = " : @ff
    crt "@fm             = " : @fm
    crt "@id             = " : @id
    crt "@im             = " : @im
    crt "@level          = " : @level
    crt "@lf             = " : @lf
    crt "@locale         = " : @locale
    crt "@logname        = " : @logname
    crt "@lptrhigh       = " : @lptrhigh
    crt "@month          = " : @month
    crt "@parasentence   = " : @parasentence
    crt "@path           = " : @path
    crt "@pid            = " : @pid
    crt "@record         = " : @record
    crt "@selected       = " : @selected
    crt "@time           = " : @time
    crt "@timezone       = " : @timezone
    crt "@tty            = " : @tty
    crt "@uid            = " : @uid
    crt "@user           = " : @user
    crt "@userno         = " : @userno
    crt "@vm             = " : @vm
    crt "@who            = " : @who
    crt "@year           = " : @year
*
*   abort 66, "Aborted"
*
    crt
    crt "result of bitand(6,12) is " : bitand(6,12)
    crt "result of bitload()    is " : bitload()
*
    crt
*
    a = "aaabbbcccdddbbb"
    crt "result of ereplace#1   is " : ereplace(a,"bbb","zzz")
    crt "result of ereplace#2   is " : ereplace(a,"","zzz")
    crt "result of ereplace#3   is " : ereplace(a,"bbb","")
*
    groupstore "xxx" in a using 1,1
    crt "result of groupstore   is " : a
*
    b = "abc  def    ghi"
    crt "result of trims(b)     is " : trims(b)
*
    i = 1
    crt "value of i             is " : i
    *
    perform "jmsgbox - that was syntax test that was!" setting result
    if result<1,1>=0 then crt "OK was clicked"
    if result<1,1>=1 then crt "Cancel was clicked"

    test = ""
    test = iconv("12345", "d4")
    test2 = iconv("abcdef", "mcp") 
    test3 = Iconv("10001", "MCT")
    crt "result of test   is " : test
    crt "result of test2  is " : test2
    crt "result of test3  is " : test3
*
end
