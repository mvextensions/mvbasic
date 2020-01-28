/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as path from 'path';
import * as vscode from 'vscode';

const request = require("sync-request");

export class File implements vscode.FileStat {

    type: vscode.FileType;
    ctime: number;
    mtime: number;
    size: number;

    name: string;
    attr: MVAttr;
    data?: Uint8Array;

    constructor(name: string, attr: MVAttr = MVAttr.MVATTR_FILE) {
        this.type = vscode.FileType.File;
        this.ctime = Date.now();
        this.mtime = Date.now();
        this.size = 0;
        this.name = name;
        this.attr = attr;
    }
}

export class Directory implements vscode.FileStat {

    type: vscode.FileType;
    ctime: number;
    mtime: number;
    size: number;

    name: string;
    attr: MVAttr;
    entries: Map<string, File | Directory>;
    needRefresh: boolean;

    constructor(name: string, attr: MVAttr = MVAttr.MVATTR_FOLDER) {
        this.type = vscode.FileType.Directory;
        this.ctime = Date.now();
        this.mtime = Date.now();
        this.size = 0;
        this.name = name;
        this.attr = attr;
        this.entries = new Map();
        this.needRefresh = true;
    }
}

export type Entry = File | Directory;

enum MVAttr {
    MVATTR_READONLY     = 0x0001, // item is read-only
    MVATTR_HIDDEN       = 0x0002, // item is hidden file or folder
    MVATTR_SYSTEM       = 0x0004, // item is a system file or folder
    MVATTR_VOLUME       = 0x0008, // unused (reserved)
    MVATTR_FOLDER       = 0x0010, // item is a "folder" (MV file - D, F or Q pointer)
    MVATTR_ARCHIVE      = 0x0020, // unused (reserved)
    MVATTR_SYMLINK      = 0x0040, // item is a symlink (MV Q-pointer)
    MVATTR_FILE         = 0x0080, // item is normal file (MV item)
    MVATTR_FIELD        = 0x0100, // item is a field definition (MV dictionary definition - A, S, I, V or D type)
    MVATTR_ACCOUNT      = 0x0200, // item is the account "folder" (MV account MD or VOC)
    MVATTR_ROOT         = 0x0400, // item is the root "folder"
    MVATTR_DATAONLY     = 0x8000  // when selecting files from MD, return only data (not dict) files
}

// define 3-level nested array used to represent MV dynamic array
type SubArray = Array<string>;
type ValArray = Array<string | SubArray>;
type DynArray = Array<string | ValArray>;

// define auth type
type AuthInfo = {access_token: string, token_type: string, expires_on: any};

export class RestFS implements vscode.FileSystemProvider {    

    private root: Directory;
    public RestPath: string;
    public RestAccount: string;
    public ApiVersion: number;
    private max_items: number; // max number of items to return using 'dir' action
    private def_attr: number; // default attributes to select using 'dir' action
    private auth: AuthInfo | {};

    constructor(apiVersion: number = 0) {
        this.ApiVersion = apiVersion;
    }

    initRestFS(restPath: string, restAccount: string, options:any = {}) {
        console.log("initRestFS " + restPath + " " + restAccount);
        this.root = new Directory('');
        this.root.attr |= MVAttr.MVATTR_ROOT | MVAttr.MVATTR_READONLY;
        this.RestPath = restPath;
        this.RestAccount = restAccount;
        this.max_items = (options && options.max_items) || 0;
        this.def_attr = (options && options.def_attr) || 0;
        this.auth = undefined; // must call login to get authorization
    }

    stat(uri: vscode.Uri): vscode.FileStat { 
        let entry = this._stat(uri);
        if (!entry) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        return entry;
    }

    readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {

        if(this._excluded(uri)) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }

        // can we use local cache of directory?
        let result: [string, vscode.FileType][] = [];
        let entry = this._lookupAsDirectory(uri);
        if (entry === this.root) {
            // When reading root directory, always retrieve from server.
            // User probably clicked 'refresh' button in explorer.
            entry.needRefresh = true;
        }
        if (entry && !entry.needRefresh) {
            for(let item of entry.entries.values()) {
                result.push([item.name, item.type]);
            }
            return result;
        }

        // get directory & file list from server
        const qs = "max_items=" + this.max_items + "&attr=" + this.def_attr;
        let res = request('GET', this.RestPath + path.posix.join("/dir", this.RestAccount, uri.path, "/") + "?" + qs,
            { headers: this._request_headers() });
        if (res.statusCode != 200) {
            // TODO: improve error reporting
            throw vscode.FileSystemError.FileNotFound(uri);
        }

        // parse the returned data
        let rtn = JSON.parse(res.body);
        let fileList: [{Name: string, Type: number}]; // Original RESTFS API
        let itemList: [{id: string, attr: number}]; // RESTFS API version 1
        let numItems: number;
        if (rtn.hasOwnProperty('Directories')) {
            fileList = rtn.Directories; // Original RESTFS API returns 'Directories' array for MD
            numItems = fileList.length;
        } else if (rtn.hasOwnProperty('Files')) {
            fileList = rtn.Files; // Original RESTFS API returns 'Files' array for dict or data files
            numItems = fileList.length;
        } else if (rtn.hasOwnProperty('items')) {
            itemList = rtn.items; // RESTFS API version 1 returns 'items' array
            numItems = itemList.length;
        } else {
            throw vscode.FileSystemError.FileNotFound(uri); // punt! bad response!
        }        
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri }); 

        if (!entry) {
            let basename = path.posix.basename(uri.path);
            entry = new Directory(basename);
            let parent = this._fixupParentDirectory(uri);
            parent.entries.set(basename, entry);
            parent.size += 1;
        }
        // build result array & update directory entries                           
        entry.entries = new Map();
        entry.mtime = Date.now();
        entry.size = 0;
        entry.needRefresh = false;
        let name: string;
        let attr: MVAttr;
        let item: Entry;
        for (let i = 0; i < numItems; i++) {
            if (this.ApiVersion > 0) {
                name = itemList[i].id;
                attr = itemList[i].attr || MVAttr.MVATTR_FILE;
            } else {
                name = fileList[i].Name;
                attr = fileList[i].Type == vscode.FileType.Directory ? MVAttr.MVATTR_FOLDER : MVAttr.MVATTR_FILE;
            }
            if (attr & MVAttr.MVATTR_FOLDER) {
                item = new Directory(name, attr);
            } else {
                item = new File(name, attr);
            }
            result.push([item.name, item.type]);
            entry.entries.set(item.name, item);
            entry.size += 1;
            this._fireSoon({ type: vscode.FileChangeType.Created, uri: uri.with({ path: path.posix.join(uri.path, item.name) }) });
        }
        return result;
    }

    // --- manage file contents

    // TODO: save list of failed file lookups so we don't need to hit server every time?
    readFile(uri: vscode.Uri): Uint8Array {

        if(this._excluded(uri)) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        const data = this._lookupAsFile(uri).data;
        if (data) {
            return data;
        }
        // file not loaded so load it from server using RESTFS API
        let res = request('GET', this.RestPath + path.posix.join("/file", this.RestAccount, uri.path, "/"),
            { headers: this._request_headers() });
        if (res.statusCode != 200) {
            // TODO: improve error reporting
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        let result = JSON.parse(res.body);

        let program: string;
        if (this.ApiVersion > 0) {
            // RESTFS API version 1 returns object {id: string, type: "array", data: []}
            if (result.type == "array") {
                <DynArray>(result.data).forEach(function(element: ValArray, attnbr: number, atts: DynArray) {
                    if (element instanceof Array) {                        
                        // attribute is multi-valued
                        element.forEach(function(val: SubArray, valnbr: number, vals: ValArray) {
                            if (val instanceof Array) {
                                // value is multi-sub-valued
                                vals[valnbr] = val.join(String.fromCharCode(0xF8FC));
                            }
                        });
                        atts[attnbr] = element.join(String.fromCharCode(0xF8FD));
                    }
                });
                program = result.data.join(String.fromCharCode(10));
            } else {
                // TODO: improve error reporting
                throw vscode.FileSystemError.FileNotFound(uri); // bad json format
            }
        } else if (result instanceof Array) {
            // Original RESTFS API returns array of program lines
            program = result.join(String.fromCharCode(10));
        } else {
            // TODO: improve error reporting
            throw vscode.FileSystemError.FileNotFound(uri); // bad json format
        }

        let content = Buffer.from(program);

        // We have sucessfully read a file from this uri, so the parent directories
        // must exist on the server. Make sure we have valid parent directory tree
        // so we can cache this file (refresh directories on next stat call if needed).
        let parent = this._fixupParentDirectory(uri);
        // update local file cache so we don't read from server every time
        let basename = path.posix.basename(uri.path);
        let entry = new File(basename);
        entry.mtime = Date.now();
        entry.size = content.byteLength;
        entry.data = content;
        if (!this._lookup(uri))
            parent.size += 1;
        parent.entries.set(basename, entry);
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri });
        return content;
    }

    writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): void {
    
        let entry = this._stat(uri); // may cause read from server
        if (entry instanceof Directory) {
            throw vscode.FileSystemError.FileIsADirectory(uri);
        }
        if (!entry && !options.create) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        if (entry && options.create && !options.overwrite) {
            throw vscode.FileSystemError.FileExists(uri);
        }
        
        let res: any;
        let data: string;
        if (this.ApiVersion > 0) {
            // update server using RESTFS API version 1: {id: string, type: "array", data: []}
            let dynarr: DynArray;;
            data = content.toString();
            dynarr = data.split(String.fromCharCode(10)); // only attributes, no multi-values
            if (data.search(/[\uF8FC-\uF8FD]/) != -1) {
                // multi-values and sub-values are nested arrays
                dynarr.forEach(function(element: string, attnbr: number, atts: DynArray) {
                    if (element.search(/uF8FD/) != -1) {
                        // attribute has multi-values
                        atts[attnbr] = element.split(String.fromCharCode(0xF8FD));
                        (<ValArray>atts[attnbr]).forEach(function(val: string, valnbr: number, vals: ValArray) {
                            if (val.search(/uF8FC/) != -1) {
                                // value has multi-subvalues
                                vals[valnbr] = val.split(String.fromCharCode(0xF8FC));
                            }
                        });
                    } else if (element.search(/uF8FC/) !- -1) {
                        // attribute has multi-subvalues (but no multi-values implies one multi-value)
                        atts[attnbr] = [element.split(String.fromCharCode(0xF8FC))];
                    }                    
                });
            }
            let method, action;
            if (entry) {
                method = 'PUT';
                action = '/file';
            } else {
                method = 'POST';
                action = '/create';
            }
            res = request(method, this.RestPath + path.posix.join(action, this.RestAccount, uri.path, "/"),
                { json: {id: entry.name, type: "array", data: dynarr}, headers: this._request_headers() } 
            );
        } else {
            // update server using original RESTFS API
            data = JSON.stringify(content.toString().split(String.fromCharCode(10)));
            data = "{ \"ProgramLines\" :" + data + "}";
            res = request('POST', this.RestPath + path.posix.join("/file", + this.RestAccount, uri.path, "/"),
                { json: data } // NOTE: this should really be body:data, not json:data, but this is how the original API works!
            );
        }
        if (res.statusCode != 200) {
            // TODO: better error reporting
            throw vscode.FileSystemError.FileNotFound(uri);
        }

        // We have sucessfully written a file to this uri, so the parent directories
        // must exist on the server. Make sure we have valid parent directory tree
        // so we can cache this file (refresh directories on next stat call if needed).
        let parent = this._fixupParentDirectory(uri);
        // update local file cache with changed file
        if (!entry) {
            let basename = path.posix.basename(uri.path);
            entry = new File(basename);
            parent.entries.set(basename, <File>entry);
            parent.size += 1;
            this._fireSoon({ type: vscode.FileChangeType.Created, uri });
        }
        entry.mtime = Date.now();
        entry.size = content.byteLength;
        (<File>entry).data = content;
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri });
    }

    // --- manage files/folders

    rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): void {

        if (this.ApiVersion == 0) {
            // TODO: does original RESTFS API support 'rename'?
            throw vscode.FileSystemError.FileNotFound(oldUri);
        }
        if (!options.overwrite && this._stat(newUri)) {
            throw vscode.FileSystemError.FileExists(newUri);
        }
        let qs = "newname=" + path.posix.join(this.RestAccount, newUri.path);
        let res = request('GET', this.RestPath + path.posix.join("/rename", this.RestAccount, oldUri.path + "/") + qs,
            { headers: this._request_headers() });
        if (res.statusCode != 200) {
            // TODO: better error reporting
            throw vscode.FileSystemError.FileNotFound(newUri);
        }

        // update local cache to match renamed file/directory
        let newName = path.posix.basename(newUri.path);
        let oldEntry = this._lookup(oldUri);
        if (oldEntry) {
            let oldParent = this._lookupParentDirectory(oldUri);
            (<Directory>oldParent).entries.delete(oldEntry.name);
            (<Directory>oldParent).size -= 1;
            oldEntry.name = newName;
        }
        let newEntry = this._lookup(newUri);
        let newParent = this._lookupParentDirectory(newUri);
        if (newParent) {
            if (oldEntry) {
                newParent.entries.set(newName, oldEntry);
                if (!newEntry)
                    newParent.size += 1;
            } else {
                newParent.needRefresh = true;
            }
        }
        this._fireSoon(
            { type: vscode.FileChangeType.Deleted, uri: oldUri },
            { type: vscode.FileChangeType.Created, uri: newUri }
        );
    }

    delete(uri: vscode.Uri): void {
        if (this.ApiVersion == 0) {
            // TODO: does original RESTFS API support 'delete'?
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        let res = request('DELETE', this.RestPath + path.posix.join("/file", this.RestAccount, uri.path, "/"),
            { headers: this._request_headers() });
        if (res.statusCode != 200) {
            // TODO: better error reporting
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        let dirname = uri.with({ path: path.posix.dirname(uri.path) });
        let basename = path.posix.basename(uri.path);
        let parent = this._lookupAsDirectory(dirname);
        if (parent && parent.entries.has(basename)) {
            parent.entries.delete(basename);
            parent.mtime = Date.now();
            parent.size -= 1;
        }
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri: dirname }, { type: vscode.FileChangeType.Deleted, uri });
    }

    createDirectory(uri: vscode.Uri): void {
        if (this.ApiVersion == 0) {
            // TODO: does original RESTFS API support 'create'?
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        let basename = path.posix.basename(uri.path);
        let dirname = uri.with({ path: path.posix.dirname(uri.path) });
        // make sure there is a parent directory
        let parent = this._stat(dirname);    
        if (parent == undefined || parent.type != vscode.FileType.Directory) {
            // TODO: better error reporting
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        // send 'create' request to server
        let qs = "dir=true";
        let res = request('POST', this.RestPath + path.posix.join("/create", this.RestAccount, uri.path, "/") + "?" + qs,
            { headers: this._request_headers() });
        if (res.statusCode != 200) {
            // TODO: better error reporting
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        let entry = new Directory(basename);
        (<Directory>parent).entries.set(entry.name, entry);
        parent.mtime = Date.now();
        parent.size += 1;
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri: dirname }, { type: vscode.FileChangeType.Created, uri });
    }

    // --- other API methods, not part of FileSystemProvider, but necessary
    public login(login_params: object) : boolean {
        let my_login_params = {...login_params, Client: "vscode.restfs"};
        let res = request('POST', this.RestPath + "/login",
            { json: my_login_params, headers: this._request_headers() });
        if (res.statusCode != 200) {            
            return false;
        }
        if (res.body) {
            try {
                this.auth = JSON.parse(res.body);
                return true;
            } catch(e) {
                return false;
            }
        }
        this.auth = {};
        return true; //empty body with status 200 is OK (authorized)
    }

    public logout() : void {
        let path = this.RestPath + "/logout";
        let headers = this._request_headers();
        this.auth = undefined;
        setTimeout(() => {
            request('GET', path, { headers: headers });            
        }, 1);                
    }

    // --- lookup

    private _stat(uri: vscode.Uri): Entry | undefined { 
        let entry = undefined;
        if(!this._excluded(uri)) {
            // see if file / directory is in local cache      
            entry = this._lookup(uri);
            if (!entry) {
                // not in local cache, try to read directory from server
                try {
                    this.readDirectory(uri);
                    entry = this._lookup(uri);
                } catch(e) {}
            }
            if (!entry) {
                // not in local cache, try to read file from server
                try {
                    this.readFile(uri);
                    entry = this._lookup(uri);
                } catch(e) {}
            }
        }
        return entry;
    }

    private _lookup(uri: vscode.Uri): Entry | undefined {
        let parts = uri.path.split('/');
        let entry: Entry = this.root;
        for (const part of parts) {
            if (!part) {
                continue;
            }
            let child: Entry | undefined;
            if (entry instanceof Directory) {
                child = entry.entries.get(part);
            }
            if (!child) {
                return undefined;
           }
            entry = child;
        }
        return entry;
    }

    private _lookupAsDirectory(uri: vscode.Uri): Directory | undefined {
        let entry = this._lookup(uri);
        if (entry instanceof Directory) {
            return entry;
        }
        return undefined;;
    }

    private _lookupAsFile(uri: vscode.Uri): File | undefined {
        let entry = this._lookup(uri);
        if (entry instanceof File) {
            return entry;
        }
        return undefined;
    }

    private _lookupParentDirectory(uri: vscode.Uri): Directory | undefined {
        if (uri.path === '/')
            return this.root;
        const dirname = uri.with({ path: path.posix.dirname(uri.path) });
        return this._lookupAsDirectory(dirname);
    }

    // We have sucessfully read a file or directory from this uri, so the parent
    // directories must exist on the server. Make sure we have valid directory
    // tree in the local cache, inserting any missing nodes in the tree as
    // needed. Any inserted nodes are flagged for refresh. Return the parent
    // directory, same as _lookupParentDirectory() above.
    private _fixupParentDirectory(uri: vscode.Uri) : Directory {
        let parent = this._lookupParentDirectory(uri);
        if (parent instanceof Directory)
            return parent;
        if (uri.path === "/")
            throw vscode.FileSystemError.FileNotFound(uri);
        let next_parent = this._fixupParentDirectory(uri.with({ path: path.posix.dirname(uri.path) }));
        let basename = path.posix.basename(uri.path);
        let entry = new Directory(basename);
        next_parent.entries.set(entry.name, entry);
        next_parent.mtime = Date.now();
        next_parent.size += 1;
        next_parent.needRefresh = true;
        return entry;
    }

    // test for certain excluded directories
    // TODO: for gateway, exclude files that end with ".Lib"
    private _excluded(uri: vscode.Uri): boolean {
        if ((uri.path + '/').substr(0, 9) === '/.vscode/')
            return true;
        if ((uri.path + '/').substr(0,6) === '/.git/')
            return true;
        if ((uri.path + '/').substr(0, 14) === '/node_modules/')
            return true;
        if (path.posix.basename(uri.path) === "pom.xml")
            return true;
        return false;
    }

    private _request_headers(): Object {
        if (this.auth && "access_token" in this.auth && "token_type" in this.auth) {
            return {authorization: this.auth.token_type + " " + this.auth.access_token,
                    accept: "application/json"};
        }
        return {accept: "application/json"};
    }

    // --- manage file events

    private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    private _bufferedEvents: vscode.FileChangeEvent[] = [];
    private _fireSoonHandle?: NodeJS.Timer;

    readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

    watch(_resource: vscode.Uri): vscode.Disposable {
        // ignore, fires for all changes...
        return new vscode.Disposable(() => { });
    }

    private _fireSoon(...events: vscode.FileChangeEvent[]): void {
        this._bufferedEvents.push(...events);

        if (this._fireSoonHandle) {
            clearTimeout(this._fireSoonHandle);
        }

        this._fireSoonHandle = setTimeout(() => {
            this._emitter.fire(this._bufferedEvents);
            this._bufferedEvents.length = 0;
        }, 5);
    }
}
