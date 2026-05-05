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

import { inject, injectable, named } from 'inversify';
import { ContributionProvider } from '../common/contribution-provider';
import { ExternalRequest, ExternalRequestContribution, isExternalRequestMessage } from '../common/external-request';
import { BackendApplicationContribution } from './backend-application';

/**
 * Listens for external request messages from the parent process (Electron main)
 * and dispatches them to backend {@link ExternalRequestContribution}s.
 */
@injectable()
export class ExternalRequestBackendService implements BackendApplicationContribution {

    @inject(ContributionProvider) @named(ExternalRequestContribution)
    protected readonly contributions: ContributionProvider<ExternalRequestContribution>;

    onStart(): void {
        if (process.send) {
            process.on('message', (msg: unknown) => {
                if (isExternalRequestMessage(msg)) {
                    this.handleExternalRequest(msg.request);
                }
            });
        }
    }

    protected async handleExternalRequest(request: ExternalRequest): Promise<void> {
        for (const contribution of this.contributions.getContributions()) {
            try {
                await contribution.onExternalRequest(request);
            } catch (err) {
                console.error('Error in ExternalRequestContribution:', err);
            }
        }
    }
}
