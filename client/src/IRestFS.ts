/*---------------------------------------------------------------------------------------------
 * Copyright (c) MV Extensions. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';

// Note: these attribute values are roughly equivalent to MSDOS file
// attributes and .NET FileAttributes. ATTR_SYMLINK would more correctly
// be mapped to FileAttributes.ReparsePoint, but there is not a precise
// correlation here. Hopefully a vscode update will provide a FileType
// for ReadOnly.
export const enum RestFSAttr {
    ATTR_READONLY     = 0x0001, // item is read-only
    ATTR_HIDDEN       = 0x0002, // item is hidden file or folder
    ATTR_SYSTEM       = 0x0004, // item is a system file or folder
    ATTR_VOLUME       = 0x0008, // unused (reserved)
    ATTR_FOLDER       = 0x0010, // item is a "folder" (MV file - D, F or Q pointer)
    ATTR_ARCHIVE      = 0x0020, // unused (reserved)
    ATTR_SYMLINK      = 0x0040, // item is a symlink (MV Q-pointer)
    ATTR_FILE         = 0x0080, // item is normal file (MV item)
    ATTR_FIELD        = 0x0100, // item is a field definition (MV dictionary definition - A, S, I, V or D type)
    ATTR_ACCOUNT      = 0x0200, // item is the account "folder" (MV account MD or VOC)
    ATTR_ROOT         = 0x0400, // item is the root "folder"
    ATTR_DATAONLY     = 0x8000  // when selecting files from MD, return only data (not dict) files
}

export interface IRestFS extends vscode.FileSystemProvider {
    RestPath: string;
    RestAccount: string;
    ApiVersion: number;
    MaxItems: number;
    SelAttr: number;
    initRestFS(restPath: string, restAccount: string, options: any): void;
    stat(uri: vscode.Uri): vscode.FileStat | Promise<vscode.FileStat>;
    readDirectory(uri: vscode.Uri): [string, vscode.FileType][] | Promise<[string, vscode.FileType][]>;
    readFile(uri: vscode.Uri): Uint8Array | Promise<Uint8Array>;
    writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): void | Promise<void>;
    rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): void | Promise<void>;
    delete(uri: vscode.Uri): void | Promise<void>;
    createDirectory(uri: vscode.Uri): void | Promise<void>;
    login(login_params: object): Promise<void>;
    logout(): Promise<void>;
    command(command: string, uri?: vscode.Uri, options?: any): Promise<void>;
    call(func: string, ...args: any[]): any | Promise<any>;
}
