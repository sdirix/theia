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

import * as assert from 'assert';
import { ExternalRequestBackendService } from './external-request-backend-service';
import { ExternalRequest, ExternalRequestContribution } from '../common/external-request';
import { ContributionProvider } from '../common/contribution-provider';

describe('ExternalRequestBackendService', () => {

    let service: ExternalRequestBackendService;
    let receivedRequests: ExternalRequest[];

    beforeEach(() => {
        receivedRequests = [];
        service = new ExternalRequestBackendService();

        const mockContributionProvider: ContributionProvider<ExternalRequestContribution> = {
            getContributions(): ExternalRequestContribution[] {
                return [{
                    onExternalRequest(request: ExternalRequest): void {
                        receivedRequests.push(request);
                    }
                }];
            }
        };
        (service as unknown as { contributions: ContributionProvider<ExternalRequestContribution> }).contributions = mockContributionProvider;
    });

    it('should dispatch external requests to contributions', async () => {
        const request: ExternalRequest = {
            rawArgs: ['/test/dir', '--flag', '/test/file.ts'],
            cwd: '/test',
            secondInstance: true
        };

        await (service as unknown as { handleExternalRequest(r: ExternalRequest): Promise<void> }).handleExternalRequest(request);

        assert.strictEqual(receivedRequests.length, 1);
        assert.deepStrictEqual(receivedRequests[0], request);
    });

    it('should handle errors in contributions gracefully', async () => {
        const errorProvider: ContributionProvider<ExternalRequestContribution> = {
            getContributions(): ExternalRequestContribution[] {
                return [
                    {
                        onExternalRequest(): void {
                            throw new Error('Test error');
                        }
                    },
                    {
                        onExternalRequest(r: ExternalRequest): void {
                            receivedRequests.push(r);
                        }
                    }
                ];
            }
        };
        (service as unknown as { contributions: ContributionProvider<ExternalRequestContribution> }).contributions = errorProvider;

        const request: ExternalRequest = {
            rawArgs: [],
            cwd: '/test',
            secondInstance: false
        };

        await (service as unknown as { handleExternalRequest(r: ExternalRequest): Promise<void> }).handleExternalRequest(request);

        assert.strictEqual(receivedRequests.length, 1);
    });

    it('should handle empty contribution list', async () => {
        const emptyProvider: ContributionProvider<ExternalRequestContribution> = {
            getContributions(): ExternalRequestContribution[] {
                return [];
            }
        };
        (service as unknown as { contributions: ContributionProvider<ExternalRequestContribution> }).contributions = emptyProvider;

        const request: ExternalRequest = {
            rawArgs: [],
            cwd: '/test',
            secondInstance: false
        };

        await (service as unknown as { handleExternalRequest(r: ExternalRequest): Promise<void> }).handleExternalRequest(request);
    });
});
