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

import { ContainerModule } from 'inversify';
import { bindRootContributionProvider } from '../../common/contribution-provider';
import { ExternalRequestContribution } from '../../common/external-request';
import { FrontendApplicationContribution } from '../../browser/frontend-application-contribution';
import { ExternalRequestFrontendService } from '../../browser/external-request-frontend-service';
import { ElectronExternalRequestAdapter } from '../electron-external-request-adapter';

export default new ContainerModule(bind => {
    bind(ExternalRequestFrontendService).toSelf().inSingletonScope();
    bind(ElectronExternalRequestAdapter).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(ElectronExternalRequestAdapter);
    bindRootContributionProvider(bind, ExternalRequestContribution);
});
