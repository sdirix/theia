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
import { FrontendApplicationContribution } from '../browser/frontend-application-contribution';
import { ExternalRequestFrontendService } from '../browser/external-request-frontend-service';

/**
 * Thin Electron-specific adapter that bridges IPC events from the main process
 * to the generic {@link ExternalRequestFrontendService}.
 */
@injectable()
export class ElectronExternalRequestAdapter implements FrontendApplicationContribution {

    @inject(ExternalRequestFrontendService)
    protected readonly service: ExternalRequestFrontendService;

    onStart(): void {
        window.electronTheiaCore.onExternalRequest(request => {
            this.service.handleRequest(request);
        });
    }
}
