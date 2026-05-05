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

import * as yargs from 'yargs';
import * as path from 'path';
import { promises as fs } from 'fs';
import { inject, injectable, named } from 'inversify';
import { ContributionProvider } from '../common/contribution-provider';
import { CliExternalRequest, ExternalRequestContribution } from '../common/external-request';
import { CliContribution } from './cli';

/**
 * A {@link CliContribution} that captures positional arguments and forwards them
 * to backend {@link ExternalRequestContribution}s. This provides CLI parameter support
 * for the browser (non-Electron) variant of Theia.
 */
@injectable()
export class ExternalRequestCliContribution implements CliContribution {

    @inject(ContributionProvider) @named(ExternalRequestContribution)
    protected readonly contributions: ContributionProvider<ExternalRequestContribution>;

    configure(conf: yargs.Argv): void {
        // No additional options needed
    }

    async setArguments(args: yargs.Arguments): Promise<void> {
        const raw = args._.map(String);
        const cwd = process.cwd();
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

        const request: CliExternalRequest = {
            type: 'cli',
            raw,
            cwd,
            secondInstance: false,
            directory,
            file,
            parameters
        };

        await this.dispatch(request);
    }

    protected async dispatch(request: CliExternalRequest): Promise<void> {
        for (const contribution of this.contributions.getContributions()) {
            try {
                await contribution.onExternalRequest(request);
            } catch (err) {
                console.error('Error in ExternalRequestContribution:', err);
            }
        }
    }
}
