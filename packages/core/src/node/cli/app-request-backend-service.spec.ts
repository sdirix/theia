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

import { expect } from 'chai';
import { Container } from 'inversify';
import { AppRequest, AppRequestContribution } from '../../common/app-request';
import { bindRootContributionProvider } from '../../common/contribution-provider';
import { AppRequestBackendService } from './app-request-backend-service';

describe('AppRequestBackendService', () => {

    function setup(contributions: AppRequestContribution[]): AppRequestBackendService {
        const container = new Container();
        bindRootContributionProvider(container.bind.bind(container), AppRequestContribution);
        for (const c of contributions) {
            container.bind(AppRequestContribution).toConstantValue(c);
        }
        container.bind(AppRequestBackendService).toSelf().inSingletonScope();
        return container.get(AppRequestBackendService);
    }

    const fakeRequest: AppRequest = { kind: 'cli' };

    it('invokes all registered contributions in order', async () => {
        const calls: string[] = [];
        const a: AppRequestContribution = { onAppRequest: () => { calls.push('a'); } };
        const b: AppRequestContribution = { onAppRequest: () => { calls.push('b'); } };
        const c: AppRequestContribution = { onAppRequest: () => { calls.push('c'); } };
        const service = setup([a, b, c]);
        await service.dispatch(fakeRequest);
        expect(calls).to.deep.equal(['a', 'b', 'c']);
    });

    it('a throwing contribution does not prevent later ones from running', async () => {
        const calls: string[] = [];
        const a: AppRequestContribution = { onAppRequest: () => { calls.push('a'); throw new Error('boom'); } };
        const b: AppRequestContribution = { onAppRequest: () => { calls.push('b'); } };
        const service = setup([a, b]);
        await service.dispatch(fakeRequest);
        expect(calls).to.deep.equal(['a', 'b']);
    });

    it('dispatch can be invoked directly without process.send (--no-cluster mode)', async () => {
        let invoked = false;
        const a: AppRequestContribution = { onAppRequest: () => { invoked = true; } };
        const service = setup([a]);
        await service.dispatch(fakeRequest);
        expect(invoked).to.equal(true);
    });
});
