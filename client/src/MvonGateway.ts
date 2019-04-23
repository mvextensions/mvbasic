const PromiseSocket = require('socket-promise');
const iconv = require('iconv-lite');

export class MvonGateway {

    constructor() {

    }
}
export class GatewayController {
    public Connected: boolean;
    public HostConnected: boolean;
    public session: any;
    public GatewayHost: string;
    public HostName: string;
    public Port: Number;
    public socket: any;
    public Response: string;
    public msgLength: number;
    public codePage: string;


    constructor(gatewayHost: string, port: Number) {
        this.GatewayHost = gatewayHost;
        this.Port = port;

    }
    async OpenConnection(dbType: string, hostName: string, userName: string, password: string, account: string, accountPassword: string, homePath: string,gatewayDebug:string) {
        const socket = new PromiseSocket();
        await socket.connect(this.Port, this.GatewayHost);
        await this.sleep(500);
        if (socket.connecting === false) {
            this.Connected = true;
        }
        else {
            this.Connected = false;
        }
        this.socket = socket;
        let login = [dbType, hostName, userName, password, account, accountPassword, homePath,gatewayDebug];
        await this.SendMessage("connect", login);
        if (this.Response === "ok") {
            this.HostConnected = true;
        }
        else {
            this.HostConnected = false;
        }
    }
    async GetFileList() {
        let message = [""]
        await this.SendMessage("GetFileList", message)
    }
    async GetRecordList() {
        let message = [""];
        await this.SendMessage("GetRecordList", message);
    }
    async ReadRecord(recordId: string) {
        let message = [recordId];
        await this.SendMessage("ReadRecord", message);
        let response = this.Response;
        this.Response = response;
    }

    async WriteRecord(recordId: string, record: string) {
        let data = record.replace(String.fromCharCode(13), '').split(String.fromCharCode(10)).join(String.fromCharCode(2));
        let message = [recordId, data]
        await this.SendMessage("WriteRecord", message);
    }

    async Execute(command: string) {
        let message = [command]
        await this.SendMessage("Execute", message);
        let response = this.Response;
        this.Response = iconv.decode(response, this.codePage);
    }

    async OpenFile(fileName: string) {
        let message = [fileName];
        await this.SendMessage("OpenFile", message);
    }
    async SendMessage(messageType: string, args: string[]) {
        let messageNo = messageType.toString();
        for (let i = 0; i < args.length; i++) {
            messageNo += String.fromCharCode(1) + args[i];
        }
        messageNo = this.pad(messageNo.length.toString(), 6) + messageNo;

        let buffer = iconv.encode(messageNo, this.codePage);

        this.socket.write(buffer);
        //let response = "";
        let headerFound = false;
        await this.socket.recv().then(async (response: string) => {
            if (response.length >= 6 && headerFound === false) {
                this.msgLength = Number(response.toString().substr(0, 6));
                this.Response = iconv.decode(response,this.codePage).substr(6);
                headerFound = true;
            }

            while (this.Response.length < this.msgLength) {
                response = await this.socket.recv();
                this.Response += iconv.decode(response,this.codePage);
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