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

import { injectable } from 'inversify';
import { ExternalRequest, CliExternalRequest, ExternalRequestContribution } from '@theia/core/lib/common/external-request';

@injectable()
export class SampleCliElectronMainContribution implements ExternalRequestContribution {

    onExternalRequest(request: ExternalRequest): void {
        console.log('[api-samples] [electron-main] External request received:', request.type);
        if (CliExternalRequest.is(request)) {
            console.log('[api-samples] [electron-main]   secondInstance:', request.secondInstance);
            console.log('[api-samples] [electron-main]   cwd:', request.cwd);
            console.log('[api-samples] [electron-main]   raw:', request.raw);
            console.log('[api-samples] [electron-main]   directory:', request.directory);
            console.log('[api-samples] [electron-main]   file:', request.file);
            console.log('[api-samples] [electron-main]   parameters:', request.parameters);
        }
    }
}
