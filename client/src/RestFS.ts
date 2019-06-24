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

    constructor(name: string) {
        this.type = vscode.FileType.Directory;
        this.ctime = Date.now();
        this.mtime = Date.now();
        this.size = 0;
        this.name = name;
        this.entries = new Map();
    }
}

export type Entry = File | Directory;

export class RestFS implements vscode.FileSystemProvider {

    root = new Directory('');
    RestPath: string = ""
    RestAccount: string = ""
    // --- manage file metadata
    setRestFS(restPath: string, restAccount: string) {
        this.RestPath = restPath;
        this.RestAccount = restAccount;
    }

    stat(uri: vscode.Uri): vscode.FileStat {
        
        return this._lookup(uri, false);
    }

    readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {

        let result: [string, vscode.FileType][] = [];
        if (uri.path != "/") {
            // add directories to account
            let fileName = uri.path.substr(1);
            var res = request('GET', this.RestPath + "/dir/" + this.RestAccount + "/" + fileName + "/");
            var fileList = JSON.parse(res.body);
            for (let i = 0; i < fileList.Files.length; i++) {
                result.push([fileList.Files[i].Name, fileList.Files[i].Type])
            }
            return result;
        }
        else {
            const entry = this._lookupAsDirectory(uri, false);
            let result: [string, vscode.FileType][] = [];
            for (const [name, child] of entry.entries) {
                result.push([name, child.type]);
            }
            return result;
        }
    }

    // --- manage file contents

    readFile(uri: vscode.Uri): Uint8Array {
        const data = this._lookupAsFile(uri, false).data;
        if (data) {
            return data;
        }
        // file not loaded so load it now
        let parts = uri.path.split("/");
        let fileName = parts[1];
        let recordId = parts[2];
        var res = request('GET', this.RestPath + "/file/" + this.RestAccount + "/" + fileName + "/" + recordId + "/");
        var program = JSON.parse(res.body);
        this.writeFile(uri, Buffer.from(program.join(String.fromCharCode(10))), { create: true, overwrite: true })
        return Buffer.from(program.join(String.fromCharCode(10)));
    }

    writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): void {
        let basename = path.posix.basename(uri.path);
        let parent = this._lookupParentDirectory(uri);
        let entry = parent.entries.get(basename);
        let newEntry = false;
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
        if (newEntry === false) {
            // update via REST to mvon# server
            let data = JSON.stringify(content.toString().split(String.fromCharCode(10)));
            data = "{ \"ProgramLines\" :" + data + "}";
            request('POST', this.RestPath + "/file/" + this.RestAccount + "/" + parent.name + "/" + entry.name + "/",
                { json: data }
            );
        }
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
        const dirname = uri.with({ path: path.posix.dirname(uri.path) });
        return this._lookupAsDirectory(dirname, false);
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
