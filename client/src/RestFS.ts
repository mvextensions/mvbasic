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
    data?: Uint8Array;

    constructor(name: string) {
        this.type = vscode.FileType.File;
        this.ctime = Date.now();
        this.mtime = Date.now();
        this.size = 0;
        this.name = name;
    }
}

export class Directory implements vscode.FileStat {

    type: vscode.FileType;
    ctime: number;
    mtime: number;
    size: number;

    name: string;
    entries: Map<string, File | Directory>;
    needRefresh: boolean;

    constructor(name: string) {
        this.type = vscode.FileType.Directory;
        this.ctime = Date.now();
        this.mtime = Date.now();
        this.size = 0;
        this.name = name;
        this.entries = new Map();
        this.needRefresh = true;
    }
}

export type Entry = File | Directory;

export class RestFS implements vscode.FileSystemProvider {

    private root: Directory;
    public RestPath: string;
    public RestAccount: string;

    constructor(restPath: string = "", restAccount: string = "") {
        this.initRestFS(restPath, restAccount);
    }

    initRestFS(restPath: string, restAccount: string) {
        this.root = new Directory('');
        this.RestPath = restPath;
        this.RestAccount = restAccount;
    }

    stat(uri: vscode.Uri): vscode.FileStat { 
        var entry = undefined;
        if(!this._excluded(uri)) {
            // see if file / directory is in local cache      
            entry = this._lookup(uri, false);
            if (!entry) {
                // not in local cache, try to read directory from server
                try {
                    this.readDirectory(uri);
                    entry = this._lookup(uri, false);
                } catch(e) {
                }
            }
            if (!entry) {
                // not in local cache, try to read file from server
                try {
                    this.readFile(uri);
                    entry = this._lookup(uri, false);
                } catch(e) {
                }
            }
        }
        if (!entry) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        return entry;
    }

    // TODO: do we need to refresh local cache?
    readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
        if(this._excluded(uri)) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        var result: [string, vscode.FileType][] = [];
        var entry: Entry = this._lookupAsDirectory(uri, false);
        if (entry && !(<Directory>entry).needRefresh) {
            for(let item of (<Directory>entry).entries.values()) {
                result.push([item.name, item.type]);
            }
            return result;
        }
        // get directory or file list from server
        let res = request('GET', this.RestPath + "/dir/" + this.RestAccount + uri.path + (uri.path === "/" ? "" : "/")); // uri.path begins with "/"
        if (res.statusCode != 200) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        let rtn = JSON.parse(res.body);
        var fileList: [{Name: string, Type: number}];
        if (rtn.hasOwnProperty('Directories')) {
            fileList = rtn.Directories; // RESTFS API returns 'Directories' array for MD
        } else if (rtn.hasOwnProperty('Files')) {
            fileList = rtn.Files; // RESTFS API returns 'Files' array for dict or data files
        } else {
            throw vscode.FileSystemError.FileNotFound(uri); // punt! bad response!
        }        
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri }); 
        // build result array & update parent directory entries                           
        let parent = <Directory>entry;
        parent.entries = new Map();
        parent.mtime = Date.now();
        parent.size = 0;
        parent.needRefresh = false;
        for (let i = 0; i < fileList.length; i++) {
            result.push([fileList[i].Name, fileList[i].Type]);
            if (fileList[i].Type === vscode.FileType.Directory) {
                entry = new Directory(fileList[i].Name);
            } else {
                entry = new File(fileList[i].Name);
            }
            parent.entries.set(entry.name, entry);
            parent.size += 1;
            this._fireSoon({ type: vscode.FileChangeType.Created, uri: uri.with({ path: uri.path + (uri.path === "/" ? "" : "/") + entry.name }) });                            
        }
        return result;
    }

    // --- manage file contents

    // TODO: do we need to refresh local cache?
    // TODO: save list of failed file lookups so we don't need to hit server every time?
    readFile(uri: vscode.Uri): Uint8Array {
        if(this._excluded(uri)) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        const data = this._lookupAsFile(uri, false).data;
        if (data) {
            return data;
        }
        // file not loaded so load it from server using RESTFS API
        let res = request('GET', this.RestPath + "/file/" + this.RestAccount + uri.path + "/"); // uri.path begins with "/"
        if (res.statusCode != 200) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        let program = JSON.parse(res.body);
        if (program instanceof Array) {
            program = program.join(String.fromCharCode(10));
        } else {
            // TODO: handle other body formats
        }
        let content = Buffer.from(program);
        // update local file cache so we don't read every time
        let basename = path.posix.basename(uri.path);
        let parent = this._lookupParentDirectory(uri);
        let entry = new File(basename);
        parent.entries.set(basename, entry);
        entry.mtime = Date.now();
        entry.size = content.byteLength;
        entry.data = content;
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri });
        return content;
    }

    writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): void {
        let basename = path.posix.basename(uri.path);
        let parent = this._lookupParentDirectory(uri);
        let entry = parent.entries.get(basename);
        if (entry instanceof Directory) {
            throw vscode.FileSystemError.FileIsADirectory(uri);
        }
        if (!entry && !options.create) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        if (entry && options.create && !options.overwrite) {
            throw vscode.FileSystemError.FileExists(uri);
        }
        if (!entry) {
            entry = new File(basename);
            parent.entries.set(basename, entry);
            this._fireSoon({ type: vscode.FileChangeType.Created, uri });
        }
        // update server using RESTFS API
        let data = JSON.stringify(content.toString().split(String.fromCharCode(10)));
        data = "{ \"ProgramLines\" :" + data + "}";
        let res = request('POST', this.RestPath + "/file/" + this.RestAccount + "/" + parent.name + "/" + entry.name + "/",
            { json: data } // NOTE: this should be body:data, not json:data!
        );
        if (res.statusCode != 200) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        // update local file cache with changed file
        entry.mtime = Date.now();
        entry.size = content.byteLength;
        entry.data = content;
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri });
    }

    // --- manage files/folders

    rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): void {

        if (!options.overwrite && this._lookup(newUri, true)) {
            throw vscode.FileSystemError.FileExists(newUri);
        }

        let entry = this._lookup(oldUri, false);
        let oldParent = this._lookupParentDirectory(oldUri);

        let newParent = this._lookupParentDirectory(newUri);
        let newName = path.posix.basename(newUri.path);

        oldParent.entries.delete(entry.name);
        entry.name = newName;
        newParent.entries.set(newName, entry);

        this._fireSoon(
            { type: vscode.FileChangeType.Deleted, uri: oldUri },
            { type: vscode.FileChangeType.Created, uri: newUri }
        );
    }

    delete(uri: vscode.Uri): void {
        let dirname = uri.with({ path: path.posix.dirname(uri.path) });
        let basename = path.posix.basename(uri.path);
        let parent = this._lookupAsDirectory(dirname, false);
        if (!parent.entries.has(basename)) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        parent.entries.delete(basename);
        parent.mtime = Date.now();
        parent.size -= 1;
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri: dirname }, { uri, type: vscode.FileChangeType.Deleted });
    }

    createDirectory(uri: vscode.Uri): void {
        let basename = path.posix.basename(uri.path);
        let dirname = uri.with({ path: path.posix.dirname(uri.path) });
        let parent = this._lookupAsDirectory(dirname, false);
        let entry = new Directory(basename);
        parent.entries.set(entry.name, entry);
        parent.mtime = Date.now();
        parent.size += 1;
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri: dirname }, { type: vscode.FileChangeType.Created, uri });
    }

    // --- lookup

    private _lookup(uri: vscode.Uri, silent: false): Entry;
    private _lookup(uri: vscode.Uri, silent: boolean): Entry | undefined;
    private _lookup(uri: vscode.Uri, silent: boolean): Entry | undefined {
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
                if (!silent) {
                    //throw vscode.FileSystemError.FileNotFound(uri);
                    return undefined;
                } else {
                    return undefined;
                }
            }
            entry = child;
        }
        return entry;
    }

    private _lookupAsDirectory(uri: vscode.Uri, silent: boolean): Directory {
        let entry = this._lookup(uri, silent);
        if (entry instanceof Directory) {
            return entry;
        }
        throw vscode.FileSystemError.FileNotADirectory(uri);
    }

    private _lookupAsFile(uri: vscode.Uri, silent: boolean): File {
        let entry = this._lookup(uri, silent);
        if (entry instanceof File) {
            return entry;
        }
        return new File(uri.path);
        throw vscode.FileSystemError.FileIsADirectory(uri);
    }

    private _lookupParentDirectory(uri: vscode.Uri): Directory {
        if (uri.path === '/')
            return this.root;
        const dirname = uri.with({ path: path.posix.dirname(uri.path) });
        return this._lookupAsDirectory(dirname, false);
    }

    // test for certain excluded directories
    private _excluded(uri: vscode.Uri): boolean {
        if ((uri.path + '/').substr(0, 9) === '/.vscode/')
            return true;
        if ((uri.path + '/').substr(0,6) === '/.git/')
            return true;
        if ((uri.path + '/').substr(0, 14) === '/node_modules/')
            return true;
        return false;
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
