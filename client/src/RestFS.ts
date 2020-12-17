/*---------------------------------------------------------------------------------------------
 * Copyright (c) MV Extensions. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as path from 'path';
import * as vscode from 'vscode';
import { IRestFS, RestFSAttr } from './IRestFS';

const request = require("sync-request");
const Minimatch = require('minimatch').Minimatch;

type FileInfo = {attr: RestFSAttr, size?: number, ctime?: number, mtime?: number};

export class File implements vscode.FileStat {

    type: vscode.FileType;
    ctime: number;
    mtime: number;
    size: number;

    name: string;
    attr: RestFSAttr;
    data: Uint8Array;

    constructor(name: string, info: FileInfo, data?: Uint8Array) {
        this.type = vscode.FileType.File;
        this.name = name;
        this.attr = info.attr || RestFSAttr.ATTR_FILE;
        this.ctime = info.ctime || Date.now();
        this.mtime = info.mtime || Date.now();
        this.data = data;
        this.size = data ? data.length : (info.size | 0);
    }
}

export class Directory implements vscode.FileStat {

    type: vscode.FileType;
    ctime: number;
    mtime: number;
    size: number;

    name: string;
    attr: RestFSAttr;
    items: [string, vscode.FileType][];

    constructor(name: string, info: FileInfo, items?: [string, vscode.FileType][]) {
        this.type = vscode.FileType.Directory;
        this.name = name;
        this.attr = info.attr || RestFSAttr.ATTR_FOLDER;
        this.ctime = info.ctime || Date.now();
        this.mtime = info.mtime || Date.now();
        this.size = items ? items.length : (info.size || 0);
        this.items = items;
    }
}

export type Entry = File | Directory;

// define 3-level nested array used to represent MV dynamic array
type SubArray = Array<string>;
type ValArray = Array<string | SubArray>;
type DynArray = Array<string | ValArray>;

// define auth type
type AuthInfo = {access_token: string, token_type: string, expires_on: any};

// get our output channel
let _restfs_channel: vscode.OutputChannel;
function getRestFSChannel(): vscode.OutputChannel {
    if (!_restfs_channel) {
        _restfs_channel = vscode.window.createOutputChannel('MV Basic');
    }
    return _restfs_channel;
}        
let _trace_channel: vscode.OutputChannel;
function getTraceChannel(): vscode.OutputChannel {
    if (!_trace_channel) {
        _trace_channel = vscode.window.createOutputChannel('MV Basic RestFS');
    }
    return _trace_channel;
}        

export class RestFS implements IRestFS {    

    public RestPath: string;
    public RestAccount: string;
    public ApiVersion: number;
    public MaxItems: number; // max number of items to return using 'dir' action
    public SelAttr: number; // default attributes to select using 'dir' action

    private entries: Map<string, Entry>; // key = full path to dir or file
    private initialized: boolean;
    private case_insensitive: boolean;
    private auth: AuthInfo | {};
    private excludes: Array<any>;
    private root_refresh: boolean;
    private log_level: number;
    private _stat_API_not_supported: boolean;

    constructor(apiVersion: number = 0) {
        this.ApiVersion = apiVersion;
    }

    initRestFS(restPath: string, restAccount: string, options: any = {}) {
        this.entries = new Map<string, Entry>();
        this.RestPath = restPath.replace(/\/$/, ''); // strip trailing slash if there is one
        this.RestAccount = restAccount;
        this.case_insensitive = (options && options.case_insensitive) || false;
        this.MaxItems = (options && options.max_items) || 0;
        this.SelAttr = (options && options.sel_attr) || 0;
        this.auth = undefined; // must call login to get auth token
        this.root_refresh = true; // refresh root directory on next readDirectory()
        switch ((options && options.log_level) || 'off') {
            case 'messages': this.log_level = 1; break;
            case 'verbose': this.log_level = 2; break;
            default: this.log_level = 0;
        }
        // create array of excluded file globs
        this.excludes = new Array<any>();
        const excl = vscode.workspace.getConfiguration("files").get("exclude");
        if (excl) {
            for (let [key, value] of Object.entries(excl)) {
                if (value === true) {
                    // make minimatch work like vscode glob
                    if (key.substr(-1, 1) === '/') {
                        this.excludes.push(new Minimatch(key.slice(0, -1), { dot: true, nonegate: true }));
                        this.excludes.push(new Minimatch(key + "**", { dot: true, nonegate: true }));
                    } else {
                        this.excludes.push(new Minimatch(key, { dot: true, nonegate: true }));
                        this.excludes.push(new Minimatch(key + "/**", { dot: true, nonegate: true }));
                    }
                }
            }
        }
        this.initialized = true;
        this.log_level && getTraceChannel().appendLine("[RestFS] initialized: path=" + this.RestPath + " account=" + this.RestAccount);
    }

    public stat(uri: vscode.Uri): vscode.FileStat | Promise<vscode.FileStat> {
        if (!this.initialized) {
            if (uri.path === '/') {
                this.log_level>1 && getTraceChannel().appendLine("[RestFS] stat: path=/, not initialized, return empty directory");
                return new Directory('/', {attr: RestFSAttr.ATTR_FOLDER | RestFSAttr.ATTR_ROOT}, []); // don't show ! icon in explorer heading
            }
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] stat: path=" + uri.path + ", not initialized, error=FileNotFound");
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        return new Promise((resolve, reject) => {
            try {
                let entry = this._stat(uri);
                if (!entry) {
                    throw vscode.FileSystemError.FileNotFound(uri);        
                }
                resolve(entry);
            } catch (e) {
                reject(e);
            }
        });
    }

    public readDirectory(uri: vscode.Uri): [string, vscode.FileType][] | Promise<[string, vscode.FileType][]> {
        if (!this.initialized) {
            if (uri.path === '/') {
                this.log_level>1 && getTraceChannel().appendLine("[RestFS] readDirectory: path=/, not initialized, return empty directory");
                return [];
            }
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] readDirectory: path=" + uri.path + ", not initialized error");
            throw Error("Directory failed: RestFS not initialized");
        }
        return new Promise((resolve, reject) => {
            try {
                resolve(this._readDirectory(uri));
            } catch (e) {
                reject(e);
            }
        });
    }
    _readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
        
        // check if this directory is in our files.exclude
        if (this._excluded(uri)) {
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] readDirectory: path=" + uri.path + " is excluded");
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        // can we use local cache of directory?
        let entry = this._lookupAsDirectory(uri);        
        if (this.root_refresh && entry && (entry.attr & RestFSAttr.ATTR_ROOT)) {
            // When reading root directory, if we have cached
            // entry, refresh contents from server. User probably
            // clicked 'refresh' button in explorer.
            this.entries = new Map<string, Entry>();
            entry = undefined;
        }
        if (entry) {
            if (!(entry instanceof Directory)) {
                this.log_level>1 && getTraceChannel().appendLine("[RestFS] readDirectory: path=" + uri.path + " is a file, not a directory");
                throw vscode.FileSystemError.FileNotADirectory(uri);
            }
            if (entry.items) {
                this.log_level>1 && getTraceChannel().appendLine("[RestFS] readDirectory: path=" + uri.path + ", found in local cache, " + entry.items.length + " items");
                return entry.items;
            }
        }

        // get directory & file list from server
        const qs = "max_items=" + this.MaxItems + "&attr=" + this.SelAttr;
        let res = request('GET', this.RestPath + path.posix.join("/dir", this.RestAccount, uri.path) + "?" + qs,
            { headers: this._request_headers() });
        if (res.statusCode != 200) {
            let message = "";
            if ((res.statusCode !== 404) || (this.log_level>1)) {
                let resp = JSON.parse(res.body);
                if (resp && resp.message) {
                    message = resp.message;
                    if (resp.code)
                        message += " (code=" + resp.code + ")";
                    if (res.statusCode != 404) // let vscode handle FileNotFound, but display error message for any other failure
                        vscode.window.showErrorMessage(message);
                }
            }
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] readDirectory: path=" + uri.path + ", 'dir' request failed, status=" + res.statusCode + (message ? "\n" + message : ""));
            throw vscode.FileSystemError.FileNotFound(uri);
        }

        // parse the returned data
        let rtn = JSON.parse(res.body);
        let fileList: [{Name: string, Type: number}]; // Original RESTFS API
        let itemList: [{id: string, attr: number}]; // RESTFS API version 1
        let numItems: number;
        if (this.ApiVersion > 0) {
            itemList = rtn.items; // RESTFS API version 1 returns 'items' array
            numItems = itemList.length;
        } else {
            if (rtn.hasOwnProperty('Directories')) {
                fileList = rtn.Directories; // Original RESTFS API returns 'Directories' array for MD
                numItems = fileList.length;
            } else if (rtn.hasOwnProperty('Files')) {
                fileList = rtn.Files; // Original RESTFS API returns 'Files' array for dict or data files
                numItems = fileList.length;
            } else {
                throw vscode.FileSystemError.FileNotFound(uri); // punt! bad response!
            }
        }        
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri }); 
        
        // build result array & update directory entries                           
        let result: [string, vscode.FileType][] = [];
        let name: string;
        let attr: RestFSAttr;
        let type: vscode.FileType;
        for (let i = 0; i < numItems; i++) {
            if (this.ApiVersion > 0) {
                name = itemList[i].id;
                type = itemList[i].attr & RestFSAttr.ATTR_FOLDER ? vscode.FileType.Directory : vscode.FileType.File;
            } else {
                name = fileList[i].Name;
                type = fileList[i].Type;
            }
            result.push([name, type]);
            this._fireSoon({ type: vscode.FileChangeType.Created, uri: uri.with({ path: path.posix.join(uri.path, name) }) });
        }
        name = uri.path;
        if (this.case_insensitive)
            name = name.toUpperCase();
        attr = RestFSAttr.ATTR_FOLDER;
        if (name === '/') {
            attr |= RestFSAttr.ATTR_ROOT;
            // delay next refresh for 10 seconds (vscode may retrieve the root several times on startup)
            this.root_refresh = false;
            setTimeout(() => {
                this.root_refresh = true;
            }, 10000);
        }
        if (!entry) {
            entry = new Directory(name, {attr: attr}, result);
        } else {
            entry.items = result;
            entry.size = result.length;
        }
        this.entries.set(name, entry);
        this.log_level>1 && getTraceChannel().appendLine("[RestFS] readDirectory: path=" + uri.path + ", 'dir' request succeeded, " + entry.items.length + " items");            
        return result;
    }

    // --- manage file contents

    // TODO: save list of failed file lookups so we don't need to hit server every time?
    public readFile(uri: vscode.Uri): Uint8Array | Promise<Uint8Array> {
        if (!this.initialized) {
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] readFile: path=" + uri.path + ", not initialized error");
            throw Error("Read failed: RestFS not initialized");
        }
        return new Promise((resolve, reject) => {
            try {
                resolve(this._readFile(uri));
            } catch (e) {
                reject(e);
            }
        });
    }
    _readFile(uri: vscode.Uri): Uint8Array {

        // check if this file is in our files.exclude
        if (this._excluded(uri)) {
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] readFile: path=" + uri.path + " is excluded");
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        let entry = this._lookupAsFile(uri);
        if (entry) {
            if (entry.data) {
                this.log_level>1 && getTraceChannel().appendLine("[RestFS] readFile: path=" + uri.path + ", found in local cache, " + entry.size + " bytes");
                return entry.data;
            }
        }

        // file not cached so load it from server using RESTFS API
        let res = request('GET', this.RestPath + path.posix.join("/file", this.RestAccount, uri.path),
            { headers: this._request_headers() });
        if (res.statusCode != 200) {
            let message = "";
            if ((res.statusCode !== 404) || (this.log_level>1)) {
                let resp = JSON.parse(res.body);
                if (resp && resp.message) {
                    message = resp.message;
                    if (resp.code)
                        message += "(code=" + resp.code + ")";
                    if (res.statusCode != 404) // let vscode handle FileNotFound, but display error message for any other failure                    
                        vscode.window.showErrorMessage(message);
                }
            }
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] readFile: path=" + uri.path + ", 'file' request failed, status=" + res.statusCode + (message ? "\n" + message : ""));
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        let result = JSON.parse(res.body);

        let attr: RestFSAttr = 0;
        let program: string;
        if (this.ApiVersion > 0) {
            // RESTFS API version 1 returns object {id: string, type: "array", attr: number, data: []}
            attr |= result.attr; // if server sends any attributes, keep them
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
                this.log_level>1 && getTraceChannel().appendLine("[RestFS] readFile: path=" + uri.path + ", expected type 'array', found '" + result.type + "'");
                throw Error("RestFS.readFile error - response from server has invalid type: " + result.type + "; expected 'array'.");
            }
        } else if (result instanceof Array) {
            // Original RESTFS API returns array of program lines
            program = result.join(String.fromCharCode(10));
            attr = RestFSAttr.ATTR_FILE;
        } else {
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] readFile: path=" + uri.path + ", expected response to be an Array");
            throw Error("RestFS.readFile error - response from server has invalid format: expected Array.");
        }

        // update local file cache so we don't read from server every time
        let name = uri.path;
        if (this.case_insensitive)
            name = name.toUpperCase();
        if (!entry) {
            entry = new File(name, {attr: attr, size: program.length}, Buffer.from(program));
        } else {
            entry.data = Buffer.from(program);
            entry.size = program.length;
        }
        this.entries.set(name, entry);
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri });
        this.log_level>1 && getTraceChannel().appendLine("[RestFS] readFile: path=" + uri.path + ", 'file' request succeeded, " + entry.size + " bytes");            
        return entry.data;
    }

    public writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): void | Promise<void> {
        if (!this.initialized) {
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] writeFile: path=" + uri.path + ", not initialized error");
            throw Error("Write failed: RestFS not initialized");
        }
        return new Promise((resolve, reject) => {
            try {
                resolve(this._writeFile(uri, content, options));
            } catch (e) {
                reject(e);
            }
        });
    }
    _writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): void {
    
        this.log_level>1 && getTraceChannel().appendLine("[RestFS] writeFile: path=" + uri.path + ", get entry type (may call readFile)");
        let entry = this._stat(uri); // may cause lookup from server
        if (entry instanceof Directory) {
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] writeFile: path=" + uri.path + " is a directory, error=FileIsADirectory");
            throw vscode.FileSystemError.FileIsADirectory(uri);
        }
        if (!entry && !options.create) {
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] writeFile: path=" + uri.path + " create not allowed and file does not exist, error=FileNotFound");
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        if (entry && options.create && !options.overwrite) {
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] writeFile: path=" + uri.path + " attempt to create new file, but file already exists, error=FileExists");
            throw vscode.FileSystemError.FileExists(uri);
        }
        if (entry && (entry.attr & RestFSAttr.ATTR_READONLY)) {
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] writeFile: path=" + uri.path + " attempt to overwrite read-only file, error=NoPermissions");
            throw vscode.FileSystemError.NoPermissions(uri);
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
                    } else if (element.search(/uF8FC/) != -1) {
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
            res = request(method, this.RestPath + path.posix.join(action, this.RestAccount, uri.path),
                { json: {id: path.posix.basename(uri.path), type: "array", data: dynarr}, headers: this._request_headers() } 
            );
        } else {
            // update server using original RESTFS API
            data = JSON.stringify(content.toString().split(String.fromCharCode(10)));
            data = "{ \"ProgramLines\" :" + data + "}";
            res = request('POST', this.RestPath + path.posix.join("/file", this.RestAccount, uri.path),
                { json: data } // NOTE: this should really be body:data, not json:data, but this is how the original API works!
            );
        }
        if (res.statusCode != 200) {
            let message = "";
            let resp = JSON.parse(res.body);
            if (resp && resp.message) {
                message = resp.message;
                if (resp.code)
                    message += "(code=" + resp.code + ")";
                vscode.window.showErrorMessage(message);
            }
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] writeFile: path=" + uri.path + ", 'file' request failed, status=" + res.statusCode + (message ? "\n" + message : ""));
            throw vscode.FileSystemError.FileNotFound(uri);
        }

        if (!entry) {
            // update local file cache with new file
            let name = uri.path;
            if (this.case_insensitive)
                name = name.toUpperCase();
            entry = new File(name, {attr: RestFSAttr.ATTR_FILE, size: content.length}, content);
            this.entries.set(name, entry);
            this._addToParentItems(uri, entry); // fixup items array in parent
            this._fireSoon({ type: vscode.FileChangeType.Created, uri });
        } else {
            // update local file cache with updated file
            entry.mtime = Date.now();
            entry.data = content;
            entry.size = content.byteLength;
            this._fireSoon({ type: vscode.FileChangeType.Changed, uri });
        }
        this.log_level>1 && getTraceChannel().appendLine("[RestFS] writeFile: path=" + uri.path + ", 'file' request succeeded, " + entry.size + " bytes");            
    }

    // --- manage files/folders

    public rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): void | Promise<void> {
        if (!this.initialized) {
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] rename: old path=" + oldUri.path + ", new path=" + newUri.path + ", not initialized error");
            throw Error("Rename failed: RestFS not initialized");
        }
        return new Promise((resolve, reject) => {
            try {
                resolve(this._rename(oldUri, newUri, options));
            } catch (e) {
                reject(e);
            }
        });
    }
    _rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): void {
        if (this.ApiVersion == 0) {            
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] rename: old path=" + oldUri.path + ", new path=" + newUri.path + ", rename not supported by gateway");
            throw vscode.FileSystemError.FileNotFound(oldUri); // original RESTFS API does not support 'rename'
        }
        this.log_level>1 && !options.overwrite && getTraceChannel().appendLine("[RestFS] rename: new path=" + newUri.path + ", check if exists (may call readFile)");
        if (!options.overwrite && this._stat(newUri)) {
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] rename: new path=" + newUri.path + ", file exists, error=FileExists");
            throw vscode.FileSystemError.FileExists(newUri);
        }
        let qs = "newname=" + path.posix.join(this.RestAccount, newUri.path);
        let res = request('GET', this.RestPath + path.posix.join("/rename", this.RestAccount, oldUri.path) + "?" + qs,
            { headers: this._request_headers() });
        if (res.statusCode != 200) {
            let message = "";
            let resp = JSON.parse(res.body);
            if (resp && resp.message) {
                message = resp.message;
                if (resp.code)
                    message += "(code=" + resp.code + ")";
                vscode.window.showErrorMessage(message);
            }
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] rename: old path=" + oldUri.path + ", new path=" + newUri.path + " 'rename' request failed, status=" + res.statusCode + (message ? "\n" + message : ""));
            throw vscode.FileSystemError.FileNotFound(newUri);
        }

        // update local cache to match renamed file/directory
        let oldName = oldUri.path;
        let newName = newUri.path;
        if (this.case_insensitive) {
            oldName = oldName.toUpperCase();
            newName = newName.toUpperCase();
        }
        let entry = this._lookup(oldUri);
        if (entry) {
            this.entries.delete(oldName);
            entry.name = newName;
            this.entries.set(newName, entry);
            this._removeFromParentItems(oldUri); // fixup items array in parent
            this._addToParentItems(newUri, entry); // fixup items array in parent
        }
        this._fireSoon(
            { type: vscode.FileChangeType.Deleted, uri: oldUri },
            { type: vscode.FileChangeType.Created, uri: newUri }
        );
        this.log_level>1 && getTraceChannel().appendLine("[RestFS] rename: old path=" + oldUri.path + ", new path=" + newUri.path + " 'rename' request succeeded");            
    }

    public delete(uri: vscode.Uri): void | Promise<void> {
        if (!this.initialized) {
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] delete: path=" + uri.path + ", not initialized error");
            throw Error("Delete failed: RestFS not initialized");
        }
        return new Promise((resolve, reject) => {
            try {
                resolve(this._delete(uri));
            } catch (e) {
                reject(e);
            }
        });
    }
    _delete(uri: vscode.Uri): void {
        if (this.ApiVersion == 0) {        
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] delete: path=" + uri.path + ", delete not supported by gateway");
            throw vscode.FileSystemError.FileNotFound(uri); // original RESTFS API does not support 'delete'
        }
        let res = request('DELETE', this.RestPath + path.posix.join("/file", this.RestAccount, uri.path),
            { headers: this._request_headers() });
        if (res.statusCode != 200) {
            let message = "";
            let resp = JSON.parse(res.body);
            if (resp && resp.message) {
                message = resp.message;
                if (resp.code)
                    message += "(code=" + resp.code + ")";
                vscode.window.showErrorMessage(message);
            }
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] delete: path=" + uri.path + " 'file' request failed, status=" + res.statusCode + (message ? "\n" + message : ""));
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        let entry = this._lookup(uri);
        if (entry) {
            this.entries.delete(entry.name);
            this._removeFromParentItems(uri); // fixup items array in parent
        }
        this._fireSoon({ type: vscode.FileChangeType.Deleted, uri });
        this.log_level>1 && getTraceChannel().appendLine("[RestFS] delete: path=" + uri.path + " 'file' request succeeded");            
    }

    public createDirectory(uri: vscode.Uri): void | Promise<void> {
        if (!this.initialized) {
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] createDirectory: path=" + uri.path + ", not initialized error");
            throw Error("CreateDirectory failed: RestFS not initialized");
        }
        return new Promise((resolve, reject) => {
            try {
                resolve(this._createDirectory(uri));
            } catch (e) {
                reject(e);
            }
        });
    }
    _createDirectory(uri: vscode.Uri): void {
        if (this.ApiVersion == 0) {            
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] createDirectory: path=" + uri.path + ", create not supported by gateway");
            throw vscode.FileSystemError.FileNotFound(uri); // original RESTFS API does not support 'create'
        }
        let dirname = uri.with({ path: path.posix.dirname(uri.path) });
        // make sure there is a parent directory
        this.log_level>1 && getTraceChannel().appendLine("[RestFS] createDirectory: path=" + uri.path + ", check if parent directory exists (may call readDirectory)");
        let parent = this._stat(dirname);    
        if (parent === undefined || !(parent instanceof Directory)) {
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] createDirectory: path=" + uri.path + ", parent does not exist, error=FileNotADirectory");
            throw vscode.FileSystemError.FileNotADirectory(dirname);
        }
        // make sure file or directory does not exist
        this.log_level>1 && getTraceChannel().appendLine("[RestFS] createDirectory: path=" + uri.path + ", check if new directory exists (may call readDirectory)");
        let entry = this._stat(uri);
        if (entry) {
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] createDirectory: path=" + uri.path + ", new directory exists, error=FileExists");
            throw vscode.FileSystemError.FileExists(uri);
        }
        // send 'create' request to server
        let qs = "dir=true";
        let res = request('POST', this.RestPath + path.posix.join("/create", this.RestAccount, uri.path) + "?" + qs,
            { headers: this._request_headers() });
        if (res.statusCode != 200) {
            let message = "";
            let resp = JSON.parse(res.body);
            if (resp && resp.message) {
                message = resp.message;
                if (resp.code)
                    message += "(code=" + resp.code + ")";
                vscode.window.showErrorMessage(message);
            }
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] createDirectory: path=" + uri.path + " 'create' request failed, status=" + res.statusCode + (message ? "\n" + message : ""));
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        let name = uri.path;
        if (this.case_insensitive)
            name = name.toUpperCase();
        entry = new Directory(name, {attr: RestFSAttr.ATTR_FOLDER, size: 0, ctime: Date.now()}, []);
        this.entries.set(name, entry);
        this._addToParentItems(uri, entry); // fixup items array in parent
        this._fireSoon({ type: vscode.FileChangeType.Created, uri });
        this.log_level>1 && getTraceChannel().appendLine("[RestFS] createDirectory: path=" + uri.path + " 'create' request succeeded");            
    }

    // --- other API methods, not part of FileSystemProvider, but necessary

    public login(login_params: object): Promise<void> {
        if (!this.initialized) {
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] login, not initialized error");
            throw Error("Login failed: RestFS not initialized");
        }
        return new Promise((resolve, reject) => {
            try {
                resolve(this._login(login_params));
            } catch (e) {
                reject(e);
            }
        });
    }
    _login(login_params: object) : void {
        let my_login_params = {...login_params, Client: "vscode.restfs"};
        this.log_level>1 && getTraceChannel().appendLine("[RestFS] login: parameters= " + JSON.stringify(my_login_params));
        let res = request('POST', this.RestPath + "/login",
            { json: my_login_params, headers: this._request_headers() });
        if (res.statusCode != 200) { 
            let message = "";
            let resp = JSON.parse(res.body);
            if (resp && resp.message) {
                message = resp.message;
                if (resp.code)
                    message += "(code=" + resp.code + ")";
                vscode.window.showErrorMessage(message);
            }
            this.log_level && getTraceChannel().appendLine("[RestFS] login: 'login' request failed, status=" + res.statusCode + (message ? "\n" + message : ""));
            throw Error("Login failed");
        }
        if (res.body) {
            try {
                this.auth = JSON.parse(res.body);
            } catch (e) {
                this.log_level && getTraceChannel().appendLine("[RestFS] login: failed to parse response, error=" + e.toString());
                throw Error("Login failed: " + e);
            }
        } else {
            this.auth = {}; //empty body with status 200 is OK (authorized)
        }
        this.log_level && getTraceChannel().appendLine("[RestFS] login: 'login' request succeeded");
        this.log_level>1 && getTraceChannel().appendLine("[RestFS] login: auth=" + JSON.stringify(this.auth));
    }

    public logout(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                resolve(this._logout());
            } catch (e) {
                reject(e);
            }
        });
    }
    _logout(): void {
        try {
            let path = this.RestPath + "/logout";
            let headers = this._request_headers();
            this.auth = undefined;               
            request('GET', path, { headers: headers });
            this.log_level && getTraceChannel().appendLine("[RestFS] logout: 'logout' request sent (status not checked)");
        } catch (e) {
            this.log_level && getTraceChannel().appendLine("[RestFS] logout: 'logout' request error (ignored) " + e.toString());
        }
    }

    public command(command: string, uri?: vscode.Uri, options?: any): Promise<void> {
        if (!this.initialized) {
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] command: " + command + ", not initialized error");
            throw Error("Command failed: RestFS not initialized");
        }
        return new Promise((resolve, reject) => {
            try {
                resolve(this._command(command, uri, options));
            } catch (e) {
                reject(e);
            }
        });
    }
    _command(command: string, uri?: vscode.Uri, options?: any): void {
        if (this.ApiVersion > 0) {
            let cmdpath = uri ? path.posix.join(this.RestAccount, uri.path) : "";
            let opts = options ? options : {};
            var res = request('POST', this.RestPath + path.posix.join("/cmd", command, cmdpath),
                { json: opts, headers: this._request_headers() });
        } else {
            let dg = options && options.debug ? "dg" : "";
            var res = request('GET', this.RestPath + path.posix.join("/", command, this.RestAccount, uri.path, dg),
                { headers: this._request_headers() });
        }
        if (res.statusCode != 200) {
            let message = "";
            let resp = JSON.parse(res.body);
            if (resp && resp.message) {
                message = resp.message;
                if (resp.code)
                    message += "(code=" + resp.code + ")";
                vscode.window.showErrorMessage(message);
            }
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] command: " + (this.ApiVersion>0 ? "'cmd/"+command+"'" : "'"+command+"'") + " request failed, status=" + res.statusCode + (message ? "\n" + message : ""));
            throw Error("Failed to execute " + command + " for " + uri.path);
        }
        let results = JSON.parse(res.body);
        if (this.ApiVersion > 0) {
            if (results.message) {
                vscode.window.showInformationMessage(results.message);
                this.log_level>1 && getTraceChannel().appendLine("[RestFS] command result: " + results.message);
            }
            if (results.output && results.output instanceof Array) {
                const that = this;
                let message: string;
                getRestFSChannel().show();
                results.output.forEach(function(element: any) {
                    if (element instanceof Array) {
                        // [message, line, column]
                        message = element[0];
                        if (element.length > 1)
                            message += ": " + uri.path + ":" + element[1];
                        if (element.length > 2)
                            message += ":" + element[2];                        
                    } else {
                        message = element;
                    }
                    getRestFSChannel().appendLine(message);
                    that.log_level>1 && getTraceChannel().appendLine("[RestFS] command result: " + message);
                });                
            }
        } else {
            // Original API
            if (typeof results === "string") {
                // Original API 'catalog' command returns a string with the result message
                vscode.window.showInformationMessage(results);
                this.log_level>1 && getTraceChannel().appendLine("[RestFS] command result: " + results);
            } else {
                // Original API 'compile' command returns:
                // {Result: string, Errors: [{LineNo: number, ErrorMessage: string, Source: string}]}
                if (results.Result) {
                    vscode.window.showInformationMessage(results.Result);
                }
                if (results.Errors && results.Errors instanceof Array) {
                    getRestFSChannel().show();
                    for (let i = 0; i < results.Errors.length; i++) {
                        getRestFSChannel().appendLine("Line   : " + results.Errors[i].LineNo + " " + uri.path + ":" + results.Errors[i].LineNo);
                        getRestFSChannel().appendLine("Error  : " + results.Errors[i].ErrorMessage);
                        getRestFSChannel().appendLine("Source : " + results.Errors[i].Source);
                        this.log_level>1 && getTraceChannel().appendLine("[RestFS] command result: " + "Line   : " + results.Errors[i].LineNo + " " + uri.path + ":" + results.Errors[i].LineNo);
                        this.log_level>1 && getTraceChannel().appendLine("[RestFS] command result: " + "Error  : " + results.Errors[i].ErrorMesssage);
                        this.log_level>1 && getTraceChannel().appendLine("[RestFS] command result: " + "Source : " + results.Errors[i].Source);
                    }
                }
            }
        }
    }

    public call(func: string, ...args: any[]): any | Promise<any> {
        if (!this.initialized) {
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] call: " + func + ", not initialized error");
            throw Error("Call failed: RestFS not initialized");
        }
        getTraceChannel().appendLine("[RestFS] call: func=" + func + " " + args.length + " args");        
        return new Promise((resolve, reject) => {
            try {
                resolve(this._call(func, args));
            } catch(e) {
                reject(e);
            }
        });
    }
    _call(func: string, args: any[]) : any {
        getTraceChannel().appendLine("[RestFS] _call: func=" + func + " " + args.length + " args");        
        if (this.ApiVersion == 0) {        
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] call: func=" + func + ", call not supported by gateway");
            throw Error("Call not supported by gateway");
        }
        var res = request('POST', this.RestPath + path.posix.join('/call', func),
        { json: {args: args}, headers: this._request_headers() });
        if (res.statusCode != 200) {
            let message = "";
            let resp = JSON.parse(res.body);
            if (resp && resp.message) {
                message = resp.message;
                if (resp.code)
                    message += "(code=" + resp.code + ")";
                vscode.window.showErrorMessage(message);
            }
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] call: " + func + " request failed, status=" + res.statusCode + (message ? "\n" + message : ""));
            throw Error("Failed to call " + func);
        }
        let results = JSON.parse(res.body);
        if (!results.hasOwnProperty('result')) {
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] call " + func + ", no result found.");
            throw Error("RestFS.call error - response from server has invalid format: result not found.");
        }
        this.log_level>1 && getTraceChannel().appendLine("[RestFS] call result: " + JSON.stringify(results.result));
        return results.result;
    }

    // --- lookup

    private _stat(uri: vscode.Uri): Entry | undefined {       
        let entry: Entry | undefined = undefined;
        let message: string;
        if(!this._excluded(uri)) {
            // see if file / directory is in local cache      
            entry = this._lookup(uri);
            if (entry) {
                this.log_level>1 && getTraceChannel().appendLine("[RestFS] stat: path=" + uri.path + " type=" + (entry ? (entry.type===vscode.FileType.Directory?"directory":"file") : "none") + " (local cache)");
            } else {
                // not in local cache, try to read attributes from server
                if (this.ApiVersion > 0 && !this._stat_API_not_supported) {
                    let resp = request('GET', this.RestPath + path.posix.join("/stat", this.RestAccount, uri.path),
                    { headers: this._request_headers() });
                    if (resp.statusCode === 404) {
                        if (resp.message)
                            message = resp.message;
                        this.log_level>1 && getTraceChannel().appendLine("[RestFS] stat: path=" + uri.path + ", not found, status=" + resp.statusCode + (message ? "\n" + message : ""));
                    } else if (resp.statusCode === 200) {
                        const result = JSON.parse(resp.body);
                        const attr: RestFSAttr = result.attr | 0;
                        let name = uri.path;
                        if (this.case_insensitive)
                            name = name.toUpperCase();
                        if (attr & RestFSAttr.ATTR_FOLDER) {
                            entry = new Directory(name, <FileInfo>result);
                            if (uri.path === "/")
                                entry.attr |= RestFSAttr.ATTR_ROOT; // indicate this is the root, otherwise refresh does not work
                        } else if (attr & RestFSAttr.ATTR_FILE) {
                            entry = new File(name, <FileInfo>result);
                        }
                        if (entry) {                        
                            this.entries.set(name, entry);
                            this.log_level>1 && getTraceChannel().appendLine("[RestFS] stat: path=" + uri.path + ", request succeeded, attr=" + attr);            
                        }
                    } else if (resp.statusCode !== 400) {
                        message = "";
                        const result = JSON.parse(resp.body);
                        if (result && result.message)
                            message = result.message;
                        if (result && result.code)
                            message += "(code=" + result.code + ")";
                        vscode.window.showErrorMessage(message ? message : "File system 'stat' API failed (status=" + resp.statusCode + ")");
                        this.log_level>1 && getTraceChannel().appendLine("[RestFS] stat: path=" + uri.path + ", request failed, status=" + resp.statusCode + (message ? "\n" + message : ""));
                    } else {
                        this._stat_API_not_supported = true; // don't try 'stat' again - use readFile / readDir instead
                    }
                } else {
                    this._stat_API_not_supported = true;
                }            
                // Not in local cache, 'stat' API not available, so try to read directory
                // from server. If directory fails, then try to read file from server. Try
                // directory before file, so we don't end up treating D and F pointers as records.
                if (this._stat_API_not_supported) {
                    try {
                        this._readDirectory(uri);
                        entry = this._lookup(uri);
                    } catch(e) {
                        this.log_level>1 && getTraceChannel().appendLine("[RestFS] stat: readDirectory path=" + uri.path + ", exception=" + e.toString());
                    }
                    if (!entry) {
                        // not a directory, try to read file from server
                        try {
                            this._readFile(uri);
                            entry = this._lookup(uri);
                        } catch(e) {
                            this.log_level>1 && getTraceChannel().appendLine("[RestFS] stat: readFile path=" + uri.path + ", exception=" + e.toString());
                        }
                    }
                }
                this.log_level>1 && getTraceChannel().appendLine("[RestFS] stat: path=" + uri.path + " type=" + (entry ? (entry.type===vscode.FileType.Directory?"directory":"file") : "none"));
            }
        } else {
            this.log_level>1 && getTraceChannel().appendLine("[RestFS] stat: path=" + uri.path + " is excluded");
        }
        return entry;
    }

    private _lookup(uri: vscode.Uri): Entry | undefined {
        let name = uri.path;
        if (this.case_insensitive)
            name = name.toUpperCase();
        return this.entries.get(name);
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

    // --- fixup local directory cache for new, deleted or renamed files --- //
    private _addToParentItems(uri: vscode.Uri, entry: File | Directory) {
        const parent_uri = uri.with( {path: path.posix.dirname(uri.path)} );
        let parent_entry = this._lookupAsDirectory(parent_uri);
        if (parent_entry) {
            let name = path.posix.basename(uri.path);
            const item: [string, vscode.FileType] = [name, entry.attr & RestFSAttr.ATTR_FOLDER ? vscode.FileType.Directory : vscode.FileType.File];
            if (this.case_insensitive) {
                name = name.toUpperCase();
            }
            const nocase = this.case_insensitive;
            let i = parent_entry.items.findIndex(function(element: [string, vscode.FileType]) {
                if (nocase) {
                    return (element[0].toUpperCase() === name);
                } else {
                    return (element[0] === name);
                }
            });
            if (i === -1) {
                // parent 'items' array does not contain this entry, so add it
                parent_entry.items.push(item);
                parent_entry.size++;
                this._fireSoon({ type: vscode.FileChangeType.Created, uri: parent_uri });
                this.log_level>1 && getTraceChannel().appendLine("[RestFS] add " + name + " to " + parent_uri.path + " items");            
            }
        }

    }

    private _removeFromParentItems(uri: vscode.Uri) {
        const parent_uri = uri.with( {path: path.posix.dirname(uri.path)} );
        let parent_entry = this._lookupAsDirectory(parent_uri);
        if (parent_entry) {
            let name = path.posix.basename(uri.path);
            if (this.case_insensitive) {
                name = name.toUpperCase();
            }
            const nocase = this.case_insensitive;
            let i = parent_entry.items.findIndex(function(element: [string, vscode.FileType]) {
                if (nocase) {
                    return (element[0].toUpperCase() === name);
                } else {
                    return (element[0] === name);
                }
            });
            if (i !== -1) {
                // parent 'items' array contains this entry, so remove it
                parent_entry.items.splice(i, 1);
                parent_entry.size--;
                this._fireSoon({ type: vscode.FileChangeType.Created, uri: parent_uri });
                this.log_level>1 && getTraceChannel().appendLine("[RestFS] remove " + name + " from " + parent_uri.path + " items");            
            }
        }
    }

    // --- excluded directories / files
    private _excluded(uri: vscode.Uri): boolean {
        try {
            const path = uri.path;
            for (let i = 0; i < this.excludes.length; i++) {
                if (this.excludes[i].match(path))
                    return true;
            }
        } catch (e) { } // ignore errors when excludes array is not initialized
        return false;
    }

    // --- build request headers
    private _request_headers(): Object {
        try {
            if (this.auth && "access_token" in this.auth && "token_type" in this.auth) {
                return {
                    authorization: this.auth.token_type + " " + this.auth.access_token,
                    accept: "application/json"
                };
            }
        } catch (e) {} // ignore "cannot use 'in' operator to search for ..." error; auth might be a simple string from legacy gateway
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
