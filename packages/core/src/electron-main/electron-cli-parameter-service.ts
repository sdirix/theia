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

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { promises as fs } from 'fs';
import { CliParameters } from '../common/cli-parameters';
import { ExternalRequest } from '../common/external-request';
import { ElectronMainProcessArgv } from './electron-main-application';

/**
 * Overridable service that converts raw command-line arguments into a
 * {@link CliParameters} object. Adopters can rebind this service to
 * customize parameter classification.
 */
@injectable()
export class ElectronCliParameterService {

    @inject(ElectronMainProcessArgv)
    protected readonly processArgv: ElectronMainProcessArgv;

    /**
     * Classify raw argv into typed CLI parameters.
     * Adopters can override this method to customize parameter classification.
     *
     * Args consumed by known flags (`--chat`) are skipped during
     * classification to avoid treating their operands as regular files/directories.
     *
     * @param argv The raw process.argv from the invocation (including binary)
     * @param cwd The working directory of the invocation
     */
    async classify(argv: string[], cwd: string): Promise<CliParameters> {
        const rawArgs = this.processArgv.getProcessArgvWithoutBin(argv);
        const directoryPaths: string[] = [];
        const filePaths: string[] = [];
        const genericParameters: string[] = [];

        for (let i = 0; i < rawArgs.length; i++) {
            const arg = rawArgs[i];

            // Skip --chat and its operand
            if (arg === '--chat') {
                genericParameters.push(arg);
                if (i + 1 < rawArgs.length) { genericParameters.push(rawArgs[++i]); }
                continue;
            }

            if (arg.startsWith('-')) {
                genericParameters.push(arg);
                continue;
            }

            // Strip file:line:col suffix before stat'ing
            const parsed = ExternalRequest.parseFileArg(arg);
            const resolved = path.resolve(cwd, parsed.path);
            try {
                const stat = await fs.stat(resolved);
                if (stat.isDirectory()) {
                    directoryPaths.push(resolved);
                } else if (stat.isFile()) {
                    filePaths.push(resolved);
                } else {
                    genericParameters.push(arg);
                }
            } catch {
                genericParameters.push(arg);
            }
        }

        return {
            cwd,
            directoryPaths,
            filePaths,
            genericParameters,
            rawArgs,
            secondInstance: false // caller overrides this
        };
    }
}
