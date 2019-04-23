

const PromiseSocket = require('socket-promise');
const iconv = require('iconv-lite');

enum MessageType {
    Logon = 1,
    Exit,
    ExecuteCommand,
    ClearList,
    FormList,
    GetList,
    ReadList,
    SaveList,
    SelectNext,
    Select,
    CheckLastRecordRead,
    OpenFile,
    OpenDictionary,
    ReadRecord,
    ClearFile,
    CloseFile,
    DeleteRecord,
    IsRecordLocked,
    LockFile,
    UnLockFile,
    iType,
    LockRecord,
    UnLockRecord,
    ReadField,
    ReadFields,
    ReadNamedField,
    ReadNamedFields,
    Write,
    WriteField,
    WriteFields,
    CallSubroutine
}
export class NetObjects {

    constructor() {

    }
}


export class NetSession {

    public constructor(hostName: string, userId: string, password: string, account: string) {
        this.HostName = hostName;
        this.UserName = userId;
        this.Password = password;
        this.Account = account;
    }
    HostName: string;
    IpAddress: string;
    Account: string;
    UserName: string;
    Password: string;
    IsActive: boolean;
    Status: Number;
    Timeout: Number;
    Port: Number;
    LockStrategy: Number;
    ReleaseStrategy: Number;
    BlockingStrategy: Number;
    Controller: MessageController
        ;
    public async Open() {
        this.Port = 9003;
        var controller = new MessageController(this.HostName, this.Port);
        await controller.OpenConnection(this.UserName, this.Password, this.Account);
        this.Controller = controller;
        while (controller.Connected === undefined) {
            await this.sleep(100);
        }
    }
    public sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    public CreateCommand(): NetCommand {
        let netCommand = new NetCommand();
        netCommand.messageController = this.Controller;
        return netCommand;

    }
    public CreateSelectList(listNo:number): NetSelectList {
        let netSelect = new NetSelectList(listNo);
        netSelect.messageController = this.Controller;
        return netSelect;
    }

    public CreateNetFile(fileName:string):NetFile{
        let netFile = new NetFile(fileName);
        netFile.messageController = this.Controller;
        return netFile;
    }

}
export class MessageController {
    public Connected: boolean;
    public session: any;
    public HostName: string;
    public Port: Number;
    public socket: any;
    public Response: string;
    public msgLength: number;


    constructor(hostName: string, port: Number) {
        this.HostName = hostName;
        this.Port = port;

    }
    async OpenConnection(userName: string, password: string, account: string) {
        const socket = new PromiseSocket();
        await socket.connect(this.Port, this.HostName);
        await this.sleep(500);
        if (socket.connecting === false) {
            this.Connected = true;
        }
        else {
            this.Connected = false;
        }
        this.socket = socket;
        let login = [userName, password, account];
        await this.SendMessage(MessageType.Logon, login);

    }
    async SendMessage(messageType: MessageType, args: string[]) {
        let messageNo = messageType.toString();
        for (let i = 0; i < args.length; i++) {
            messageNo += String.fromCharCode(1) + args[i];
        }
        messageNo = this.pad(messageNo.length.toString(), 10) + messageNo;

        let buffer = iconv.encode(messageNo,'iso8859-1');

        this.socket.write(buffer);
        //let response = "";
        let headerFound = false;
        await this.socket.recv().then(async (response:string) => {
            if (response.length >= 10 && headerFound === false) {
                this.msgLength = Number(response.toString().substr(0, 10));
                this.Response = response.toString().substr(10);
                headerFound = true;
            }

            while (this.Response.length < this.msgLength) {
                response = await this.socket.recv();
                this.Response += response.toString();
            }

        });



    }
    pad(str: string, max: Number): string {
        str = str.toString();
        return str.length < max ? this.pad("0" + str, max) : str;
    }




    public sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
export class NetCommand {
    public Command: string;
    public Response: string;
    public CommandAtSelected: number;
    public SystemReturnCode: number;
    public messageController: MessageController;
    public CommandBlockSize: number;
    public CommandStatus: number;
    private completeResponse: string;

    constructor() {
        this.CommandBlockSize = 0;
    }
    public sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    public async Execute() {
        let command = ["", this.Command];
        await this.messageController.SendMessage(MessageType.ExecuteCommand, command).then(async () => {
            this.Response = this.messageController.Response;
            let parts = this.messageController.Response.split(String.fromCharCode(1));
            this.CommandAtSelected = Number(parts[1]);
            this.SystemReturnCode = Number(parts[2]);
            parts[3] = iconv.decode(parts[3], 'iso8859-1');
            if (this.CommandBlockSize === 0) {
                this.Response = parts[3].toString();
                this.CommandStatus = 0;
            }
            else {
                if (parts[3].length > this.CommandBlockSize) {
                    this.completeResponse = parts[3].substr(this.CommandBlockSize);
                    this.Response = parts[3].substr(0, this.CommandBlockSize);
                    this.CommandStatus = 2;
                }
                else {
                    this.CommandStatus = 0;
                    this.Response = parts[3];
                }
            }
            this.CommandStatus = Number(parts[0]);

        });

    }

    public NextBlock() {
        if (this.CommandBlockSize === 0) { return; }
        if (this.completeResponse.length > this.CommandBlockSize) {
            this.Response = this.completeResponse.substr(0, this.CommandBlockSize);
            this.completeResponse = this.completeResponse.substr(this.CommandBlockSize);

            this.CommandStatus = 2;
        }
        else {
            this.CommandStatus = 0;
            this.Response = this.completeResponse;
        }
    }
}
export class NetSelectList {
    public LastRecordRead: boolean;
    public selectListNo: number;
    public Response: string;

    public messageController: MessageController;
    constructor(selectListNo: number) {
        this.LastRecordRead = false;
        this.selectListNo = selectListNo;
    }
    public async ClearList() {
        let message = [this.selectListNo.toString()];
        await this.messageController.SendMessage(MessageType.ClearList, message);
        this.LastRecordRead = true;
    }
    public async FormList(idList: string) {
        let message = [this.selectListNo.toString(), idList];
        await this.messageController.SendMessage(MessageType.FormList, message);
    }
    public async FormListArray(idList: string[]) {
        let message = [this.selectListNo.toString(), idList.join(String.fromCharCode(254))];
        await this.messageController.SendMessage(MessageType.FormList, message);
    }
    public async GetList(listName: string) {
        let message = [this.selectListNo.toString(), listName];
        await this.messageController.SendMessage(MessageType.GetList, message);
    }
    public async ReadList() {
        let message = [this.selectListNo.toString()];
        await this.messageController.SendMessage(MessageType.ReadList, message);
        this.Response = this.messageController.Response;
    }
    public async Next() {
        let message = [this.selectListNo.toString()];
        await this.messageController.SendMessage(MessageType.SelectNext, message);
        let response = this.messageController.Response.split(String.fromCharCode(1));
        if (response[0] === "1") {
            this.LastRecordRead = true;
        }
        this.Response = response[1];
    }
    //public async SelectFile()
}
export class NetFile {
    FileName: string;
    FileStatus: number;
    FileType: number;
    FileIsOpen: boolean;
    RecordId:string;
    NetFileLockStrategy:number;
    NetFileReleaseStrategy:number;
    NetFileBlockingStrategy:number;
    Record: DynamicArray;
    public messageController: MessageController;
    constructor(fileName:string){
        this.FileName = fileName;
        this.NetFileLockStrategy = 1;
        this.NetFileReleaseStrategy = 0;
        this.NetFileBlockingStrategy = 0;
        this.Record = new DynamicArray();   
    }
    public async Write(){
        let data = this.Record.StringValue().replace(String.fromCharCode(13),'').split(String.fromCharCode(10)).join(String.fromCharCode(254));
       // data = iconv.encode(data,"iso8859-1").toString();
        let message = [this.FileName,this.RecordId,data];
        await this.messageController.SendMessage(MessageType.Write,message);
        let response = this.messageController.Response.split(String.fromCharCode(1));
        this.Record.SetValue(response[0]);

    }
    public async Read(){
        let message = [this.FileName,this.RecordId,this.NetFileLockStrategy.toString(),this.NetFileReleaseStrategy.toString(),this.NetFileBlockingStrategy.toString()];
        await this.messageController.SendMessage(MessageType.ReadRecord,message);
        let response = this.messageController.Response.split(String.fromCharCode(1));
        response[1] = iconv.decode(response[1], 'iso8859-1');
        this.Record.SetValue(response[1]);

    }
  
    public async Open()
    {
        let message = [this.FileName,this.NetFileLockStrategy.toString(),this.NetFileReleaseStrategy.toString()];
        await this.messageController.SendMessage(MessageType.OpenFile, message);
        this.FileIsOpen = true;
    }

}
export class DynamicArray {
    AM: string;
    VM: string;
    SVM: string;
    TM: string;
    public Record: any;
    public messageController: MessageController;
    constructor() {
        this.AM = String.fromCharCode(254);
        this.VM = String.fromCharCode(253);
        this.SVM = String.fromCharCode(252);
        this.TM = String.fromCharCode(251);
        this.SetValue("");
    }
    public SetValue(value: string) {
        this.Record = value.split(this.VM);
    }
    public StringValue(): string {
        return this.Record.join(this.AM);
    }
    public ExtractAttribute(attribute: number): string {
        if (attribute <= this.Record.length) {
            return this.Record[attribute - 1];
        }
        return "";
    }
    public ExtractValue(attribute: number, value: number): string {
        if (attribute <= this.Record.length) {
            let values = this.Record[attribute - 1].split(this.VM);
            if (values.length <= value) {
                return values[value - 1];
            }
        }
        return "";
    }
    public ExtractSubValue(attribute: number, value: number, subvalue: number): string {
        if (attribute <= this.Record.length) {
            let values = this.Record[attribute - 1].split(this.VM);
            if (values.length <= value) {
                let subvalues = values[value - 1].split(this.SVM);
                if (subvalues.length <= subvalue) {
                    return subvalues[subvalue - 1];
                }
            }
        }
        return "";
    }
}