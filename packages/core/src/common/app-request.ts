// *****************************************************************************
// Copyright (C) 2026 EclipseSource and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { MaybePromise } from './types';

/**
 * A request to act on the application. Originates from a CLI invocation, an
 * IPC message, a URL handler, or anywhere internal code dispatches one
 * programmatically. Dispatched to `AppRequestContribution`s across the
 * frontend, backend, and Electron main process; the `kind` discriminator
 * narrows to a concrete sub-shape.
 */
export interface AppRequest {
    readonly kind: string;
    /** Pre-parsed key/value parameters extracted from the request, keyed by flag name. */
    readonly parameters?: Readonly<Record<string, string | boolean>>;
}

/**
 * A positional CLI argument that has been resolved against the working directory
 * and classified by inspecting the filesystem.
 *
 * - `directory` — `absolutePath` is an existing directory.
 * - `workspaceFile` — `absolutePath` is an existing file whose extension is a
 *   recognised Theia/VS Code workspace file (`.theia-workspace`, `.code-workspace`).
 * - `file` — `absolutePath` is any other existing regular file. May carry an
 *   editor cursor target parsed from `path:line:col` syntax.
 *
 * Positional arguments that do not resolve to anything on disk are not included
 * in `fileSystemTargets`; they remain available in `raw` for downstream parsers.
 */
export interface DirectoryTarget {
    readonly kind: 'directory';
    readonly absolutePath: string;
}
export interface WorkspaceFileTarget {
    readonly kind: 'workspaceFile';
    readonly absolutePath: string;
}
export interface FileTarget {
    readonly kind: 'file';
    readonly absolutePath: string;
    readonly line?: number;
    readonly column?: number;
}
export type FileSystemTarget = DirectoryTarget | WorkspaceFileTarget | FileTarget;

/**
 * Concrete request originating from a command-line invocation of the
 * Electron main process (initial launch or `second-instance` event).
 */
export interface CliAppRequest extends AppRequest {
    readonly kind: 'cli';

    /** argv with the binary entry stripped. */
    readonly raw: string[];

    /** Working directory of the invocation. */
    readonly cwd: string;

    /** `true` if this came from a `second-instance` event, `false` for initial launch. */
    readonly secondInstance: boolean;

    /**
     * Positional arguments resolved against `cwd` and classified by the
     * filesystem. Order matches argv order so dispatch logic can rely on
     * "first argument" semantics (e.g. picking the primary workspace).
     */
    readonly fileSystemTargets: readonly FileSystemTarget[];
}

export namespace CliAppRequest {
    export function is(request: AppRequest): request is CliAppRequest {
        return request.kind === 'cli';
    }
    export function directories(request: CliAppRequest): DirectoryTarget[] {
        return request.fileSystemTargets.filter((t): t is DirectoryTarget => t.kind === 'directory');
    }
    export function workspaceFiles(request: CliAppRequest): WorkspaceFileTarget[] {
        return request.fileSystemTargets.filter((t): t is WorkspaceFileTarget => t.kind === 'workspaceFile');
    }
    export function files(request: CliAppRequest): FileTarget[] {
        return request.fileSystemTargets.filter((t): t is FileTarget => t.kind === 'file');
    }
}

/**
 * Cross-cutting reaction to an AppRequest. Bound separately in the electron-main,
 * electron-browser, and backend containers — every contribution in a given
 * container is invoked for every request delivered to that container.
 */
export const AppRequestContribution = Symbol('AppRequestContribution');
export interface AppRequestContribution {
    onAppRequest(request: AppRequest): MaybePromise<void>;
}

/** Node IPC message format from electron-main → backend. */
export interface AppRequestMessage {
    type: 'app-request';
    request: AppRequest;
}
export function isAppRequestMessage(msg: unknown): msg is AppRequestMessage {
    // eslint-disable-next-line no-null/no-null
    return typeof msg === 'object' && msg !== null && (msg as AppRequestMessage).type === 'app-request';
}
