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
 * Base interface for all external requests.
 * Subtypes use the {@link type} field as a discriminant.
 */
export interface ExternalRequest {
    /** Discriminant identifying the source of the request (e.g. `'cli'`). */
    readonly type: string;
}

/**
 * A CLI-originated external request with classified arguments.
 */
export interface CliExternalRequest extends ExternalRequest {
    readonly type: 'cli';
    /** Raw arguments as received (without the binary prefix). */
    readonly raw: string[];
    /** Working directory of the invocation. */
    readonly cwd: string;
    /** Whether this is a repeat invocation while the app is already running. */
    readonly secondInstance: boolean;
    /** First classified directory argument, if any (absolute path). */
    readonly directory?: string;
    /** First classified file argument, if any (absolute path). */
    readonly file?: string;
    /**
     * Parsed flag arguments.
     * `--key value` becomes `{ key: "value" }`, `--flag` (at end or before another flag) becomes `{ flag: true }`.
     * Positional arguments are not included.
     */
    readonly parameters: Readonly<Record<string, string | boolean>>;
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
 * Namespace with type guard and pure string-parsing utilities for
 * {@link CliExternalRequest}. All functions are side-effect-free and work
 * in both browser and Node environments. Path resolution against `cwd`
 * is the caller's responsibility.
 */
export namespace CliExternalRequest {

    /** Type guard for {@link CliExternalRequest}. */
    export function is(request: ExternalRequest): request is CliExternalRequest {
        return request.type === 'cli';
    }

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
     * Skips flags whose values are identified via the request's
     * {@link CliExternalRequest.parameters parameters}.
     */
    export function parseFileTargets(request: CliExternalRequest): FileTarget[] {
        const targets: FileTarget[] = [];
        const args = request.raw;
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg.startsWith('--')) {
                const key = arg.slice(2);
                // Skip the consumed value if this flag has a string parameter
                if (typeof request.parameters[key] === 'string') { i++; }
                continue;
            }
            if (arg.startsWith('-')) { continue; }       // skip short flags
            targets.push(parseFileArg(arg));
        }
        return targets;
    }

    /**
     * Parse raw arguments into a parameters record.
     * `--key=value` becomes `{ key: "value" }`.
     * `--key value` (where value does not start with `-`) becomes `{ key: "value" }`.
     * `--flag` (at end or before another flag) becomes `{ flag: true }`.
     * Positional arguments and short flags are not included.
     */
    export function parseParameters(raw: string[]): Record<string, string | boolean> {
        const params: Record<string, string | boolean> = {};
        for (let i = 0; i < raw.length; i++) {
            const arg = raw[i];
            if (arg.startsWith('--')) {
                const eqIndex = arg.indexOf('=', 2);
                if (eqIndex !== -1) {
                    const key = arg.slice(2, eqIndex);
                    if (key.length > 0) {
                        params[key] = arg.slice(eqIndex + 1);
                    }
                    continue;
                }
                const key = arg.slice(2);
                if (key.length === 0) { continue; }
                if (i + 1 < raw.length && !raw[i + 1].startsWith('-')) {
                    params[key] = raw[i + 1];
                    i++;
                } else {
                    params[key] = true;
                }
            }
        }
        return params;
    }
}

// --- Backwards compatibility aliases ---

/**
 * @deprecated Use {@link CliExternalRequest} instead.
 */
export type CliParameters = CliExternalRequest & {
    readonly directoryPaths: string[];
    readonly filePaths: string[];
    readonly genericParameters: string[];
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
