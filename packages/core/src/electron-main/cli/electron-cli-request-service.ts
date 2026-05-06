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

import * as path from 'path';
import { promises as fs } from 'fs';
import { inject, injectable } from 'inversify';
import { CliAppRequest, FileSystemTarget } from '../../common/app-request';
import { ElectronMainProcessArgv } from '../electron-main-process-argv';

/**
 * Classifies a CLI invocation (argv + cwd) into a {@link CliAppRequest}.
 *
 * Adopters can rebind this service to add custom positional/flag
 * classification. Subclasses can also override
 * {@link ElectronCliRequestService.workspaceFileExtensions} to recognise
 * additional workspace file extensions.
 */
@injectable()
export class ElectronCliRequestService {

    @inject(ElectronMainProcessArgv)
    protected readonly processArgv: ElectronMainProcessArgv;

    /**
     * Classify a CLI invocation into an AppRequest. Call sites pass the
     * full process.argv (binary included) so classification can strip the
     * binary the same way for initial and second-instance launches.
     */
    async classify(argv: string[], cwd: string, secondInstance: boolean): Promise<CliAppRequest> {
        const raw = this.processArgv.getProcessArgvWithoutBin(argv);
        const fileSystemTargets: FileSystemTarget[] = [];
        const parameters: Record<string, string | boolean> = {};

        for (let i = 0; i < raw.length; i++) {
            const arg = raw[i];
            if (arg.startsWith('-')) {
                i = this.collectFlag(raw, i, parameters);
                continue;
            }
            const target = await this.classifyPositional(arg, cwd);
            if (target) {
                fileSystemTargets.push(target);
            }
        }

        return { kind: 'cli', raw, cwd, secondInstance, fileSystemTargets, parameters };
    }

    /** Override to recognise additional workspace file extensions. */
    protected workspaceFileExtensions(): readonly string[] {
        return ['.theia-workspace', '.code-workspace'];
    }

    protected async classifyPositional(arg: string, cwd: string): Promise<FileSystemTarget | undefined> {
        const { path: pathPart, line, column } = this.parseFileArg(arg);
        const resolved = path.resolve(cwd, pathPart);
        try {
            const realPath = await fs.realpath(resolved);
            const stat = await fs.stat(realPath);
            if (stat.isDirectory()) {
                return { kind: 'directory', absolutePath: realPath };
            }
            if (stat.isFile()) {
                if (this.isWorkspaceFile(realPath)) {
                    return { kind: 'workspaceFile', absolutePath: realPath };
                }
                return { kind: 'file', absolutePath: realPath, line, column };
            }
        } catch {
            // not a path on disk — leave it unclassified, callers can still see it in `raw`
        }
        return undefined;
    }

    /**
     * Strip a `:line` or `:line:col` suffix from a positional arg.
     * Avoids stripping a bare Windows drive letter like `C:`.
     */
    protected parseFileArg(arg: string): { path: string; line?: number; column?: number } {
        const match = arg.match(/:(\d+)(?::(\d+))?$/);
        if (match) {
            const pathPart = arg.slice(0, arg.length - match[0].length);
            if (pathPart.length > 0) {
                return {
                    path: pathPart,
                    line: parseInt(match[1], 10),
                    column: match[2] !== undefined ? parseInt(match[2], 10) : undefined
                };
            }
        }
        return { path: arg };
    }

    protected isWorkspaceFile(filePath: string): boolean {
        const lower = filePath.toLowerCase();
        return this.workspaceFileExtensions().some(ext => lower.endsWith(ext));
    }

    /** Records the flag (and its value, if any) into `parameters`; returns the next index to read. */
    protected collectFlag(raw: string[], i: number, parameters: Record<string, string | boolean>): number {
        const flag = raw[i].replace(/^-+/, '');
        const next = raw[i + 1];
        if (next !== undefined && !next.startsWith('-')) {
            parameters[flag] = next;
            return i + 1;
        }
        parameters[flag] = true;
        return i;
    }
}
