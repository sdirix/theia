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
 * A generic request from an external source (CLI, IPC, URL handler, etc.).
 * Only rawArgs is mandatory. Other fields provide context from the source.
 */
export interface ExternalRequest {
    /** The raw arguments/tokens of the invocation. */
    readonly rawArgs: string[];
    /** Working directory of the invocation, if known. */
    readonly cwd?: string;
    /** Whether this is a repeat invocation while the app is already running. */
    readonly secondInstance?: boolean;
}

export const ExternalRequestContribution = Symbol('ExternalRequestContribution');

/**
 * Contribution point for reacting to external requests (CLI invocations, IPC messages, etc.).
 * This interface is used in all three layers: frontend, backend, and Electron main.
 * Each layer binds its own set of contributions independently.
 */
export interface ExternalRequestContribution {
    /**
     * Called when the application receives an external request, either from the
     * initial launch or from a subsequent invocation (second-instance).
     */
    onExternalRequest(request: ExternalRequest): MaybePromise<void>;
}

/**
 * IPC message format for forwarding external requests from the Electron main
 * process to the backend Node process.
 */
export interface ExternalRequestMessage {
    type: 'external-request';
    request: ExternalRequest;
}

export function isExternalRequestMessage(msg: unknown): msg is ExternalRequestMessage {
    return typeof msg === 'object' && !!msg && (msg as ExternalRequestMessage).type === 'external-request';
}

/**
 * Namespace with pure string-parsing utilities for extracting structured data
 * from {@link ExternalRequest} arguments. All functions are side-effect-free
 * and work in both browser and Node environments. Path resolution against
 * `cwd` is the caller's responsibility.
 */
export namespace ExternalRequest {

    export interface FileTarget {
        /** Raw path from the argument (may be relative). */
        readonly path: string;
        readonly line?: number;
        readonly column?: number;
    }

    /**
     * Parse a single argument for file:line:col syntax.
     * Matches `:N` or `:N:N` at the end of the string.
     * Handles Windows drive letters (e.g. `C:\path\file.ts:42`).
     */
    export function parseFileArg(arg: string): FileTarget {
        // Match :line or :line:col at the end, but not a Windows drive letter (single char before colon at start)
        const match = arg.match(/:(\d+)(?::(\d+))?$/);
        if (match) {
            const pathPart = arg.slice(0, arg.length - match[0].length);
            // Avoid stripping a Windows drive letter like "C:" — path must have content beyond the drive
            if (pathPart.length > 0) {
                return {
                    path: pathPart,
                    line: parseInt(match[1]),
                    column: match[2] ? parseInt(match[2]) : undefined
                };
            }
        }
        return { path: arg };
    }

    /**
     * Get all positional (non-flag) arguments as file targets.
     * Skips args consumed by known flag patterns (`--chat`).
     */
    export function parseFileTargets(request: ExternalRequest): FileTarget[] {
        const targets: FileTarget[] = [];
        const args = request.rawArgs;
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg === '--chat') { i += 1; continue; } // skip --chat and its value
            if (arg.startsWith('-')) { continue; }       // skip other flags
            targets.push(parseFileArg(arg));
        }
        return targets;
    }

    /** Get the value following a named flag (e.g. `getFlag(req, '--chat')`). */
    export function getFlag(request: ExternalRequest, flag: string): string | undefined {
        const idx = request.rawArgs.indexOf(flag);
        if (idx >= 0 && idx + 1 < request.rawArgs.length) {
            return request.rawArgs[idx + 1];
        }
        return undefined;
    }

    /** Check whether a flag is present. */
    export function hasFlag(request: ExternalRequest, flag: string): boolean {
        return request.rawArgs.includes(flag);
    }
}

// --- Backwards compatibility aliases ---

/**
 * @deprecated Use {@link ExternalRequest} instead.
 */
export type CliParameters = ExternalRequest & {
    readonly cwd: string;
    readonly directoryPaths: string[];
    readonly filePaths: string[];
    readonly genericParameters: string[];
    readonly secondInstance: boolean;
};

/**
 * @deprecated Use {@link ExternalRequestContribution} instead.
 */
export const CliInvocationContribution = ExternalRequestContribution;
/**
 * @deprecated Use {@link ExternalRequestContribution} instead.
 */
export type CliInvocationContribution = ExternalRequestContribution;

/**
 * @deprecated Use {@link ExternalRequestMessage} instead.
 */
export type CliInvocationMessage = ExternalRequestMessage;

/**
 * @deprecated Use {@link isExternalRequestMessage} instead.
 */
export const isCliInvocationMessage = isExternalRequestMessage;
