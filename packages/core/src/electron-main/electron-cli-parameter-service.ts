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
import { CliExternalRequest } from '../common/external-request';
import { ElectronMainProcessArgv } from './electron-main-process-argv';

/**
 * Overridable service that converts raw command-line arguments into a
 * {@link CliExternalRequest} object. Adopters can rebind this service to
 * customize parameter classification.
 */
@injectable()
export class ElectronCliParameterService {

    @inject(ElectronMainProcessArgv)
    protected readonly processArgv: ElectronMainProcessArgv;

    /**
     * Classify raw argv into a structured CLI request.
     * Adopters can override this method to customize parameter classification.
     *
     * Flags with string values are skipped during directory/file classification.
     *
     * @param argv The raw process.argv from the invocation (including binary)
     * @param cwd The working directory of the invocation
     */
    async classify(argv: string[], cwd: string): Promise<CliExternalRequest> {
        const raw = this.processArgv.getProcessArgvWithoutBin(argv);
        const parameters = CliExternalRequest.parseParameters(raw);

        let directory: string | undefined;
        let file: string | undefined;

        for (let i = 0; i < raw.length; i++) {
            const arg = raw[i];

            // Skip flags; also skip consumed value for flags with string parameters
            if (arg.startsWith('--')) {
                const key = arg.slice(2);
                if (typeof parameters[key] === 'string') { i++; }
                continue;
            }

            if (arg.startsWith('-')) {
                continue;
            }

            // Positional arg — classify via fs.stat
            const parsed = CliExternalRequest.parseFileArg(arg);
            const resolved = path.resolve(cwd, parsed.path);
            try {
                const stat = await fs.stat(resolved);
                if (stat.isDirectory() && !directory) {
                    directory = resolved;
                } else if (stat.isFile() && !file) {
                    file = resolved;
                }
            } catch {
                // not a valid path, ignore
            }
        }

        return {
            type: 'cli',
            raw,
            cwd,
            secondInstance: false, // caller overrides this
            directory,
            file,
            parameters
        };
    }
}
