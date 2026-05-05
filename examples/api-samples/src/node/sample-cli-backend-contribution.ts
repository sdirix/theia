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

import { injectable } from '@theia/core/shared/inversify';
import { ExternalRequest, ExternalRequestContribution } from '@theia/core/lib/common/external-request';

@injectable()
export class SampleCliBackendContribution implements ExternalRequestContribution {

    onExternalRequest(request: ExternalRequest): void {
        console.log('[api-samples] [backend] External request received:');
        console.log('[api-samples] [backend]   secondInstance:', request.secondInstance);
        console.log('[api-samples] [backend]   cwd:', request.cwd);
        console.log('[api-samples] [backend]   rawArgs:', request.rawArgs);
    }
}
