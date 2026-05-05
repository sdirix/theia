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
import { ExternalRequest, ExternalRequestContribution } from '../common/external-request';

/**
 * Generic service that dispatches {@link ExternalRequest}s to frontend
 * {@link ExternalRequestContribution}s. Platform-specific adapters
 * (e.g. Electron IPC) call {@link handleRequest} to trigger dispatch.
 */
@injectable()
export class ExternalRequestFrontendService {

    @inject(ContributionProvider) @named(ExternalRequestContribution)
    protected readonly contributions: ContributionProvider<ExternalRequestContribution>;

    async handleRequest(request: ExternalRequest): Promise<void> {
        for (const contribution of this.contributions.getContributions()) {
            try {
                await contribution.onExternalRequest(request);
            } catch (err) {
                console.error('Error in ExternalRequestContribution:', err);
            }
        }
    }
}
