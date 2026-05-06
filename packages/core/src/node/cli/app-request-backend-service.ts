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

import { inject, injectable, named, postConstruct } from 'inversify';
import { AppRequest, AppRequestContribution, isAppRequestMessage } from '../../common/app-request';
import { ContributionProvider } from '../../common/contribution-provider';
import { BackendApplicationContribution } from '../backend-application';
import { backendGlobal } from '../backend-global';

@injectable()
export class AppRequestBackendService implements BackendApplicationContribution {

    @inject(ContributionProvider) @named(AppRequestContribution)
    protected readonly contributions: ContributionProvider<AppRequestContribution>;

    @postConstruct()
    protected init(): void {
        // Expose the dispatcher for `--no-cluster` mode where the backend runs
        // in-process with the electron-main and there is no IPC channel to use.
        backendGlobal.appRequestDispatch = request => this.dispatch(request);
    }

    onStart(): void {
        if (process.send) {
            process.on('message', (msg: unknown) => {
                if (isAppRequestMessage(msg)) {
                    this.dispatch(msg.request);
                }
            });
        }
    }

    /** Public so single-process (`--no-cluster`) mode can call it directly. */
    async dispatch(request: AppRequest): Promise<void> {
        for (const contribution of this.contributions.getContributions()) {
            try {
                await contribution.onAppRequest(request);
            } catch (err) {
                console.error('Error in backend AppRequestContribution:', err);
            }
        }
    }
}
