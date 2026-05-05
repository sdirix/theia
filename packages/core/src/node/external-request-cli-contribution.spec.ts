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
import * as path from 'path';
import * as os from 'os';
import { promises as fs } from 'fs';
import { ExternalRequestCliContribution } from './external-request-cli-contribution';
import { ExternalRequest, CliExternalRequest, ExternalRequestContribution } from '../common/external-request';
import { ContributionProvider } from '../common/contribution-provider';

describe('ExternalRequestCliContribution', () => {

    let contribution: ExternalRequestCliContribution;
    let receivedRequests: ExternalRequest[];
    let tmpDir: string;
    let testFile: string;
    let testSubDir: string;

    before(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'theia-cli-contrib-test-'));
        testFile = path.join(tmpDir, 'test-file.ts');
        testSubDir = path.join(tmpDir, 'test-subdir');
        await fs.writeFile(testFile, 'content');
        await fs.mkdir(testSubDir);
    });

    after(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    beforeEach(() => {
        receivedRequests = [];
        contribution = new ExternalRequestCliContribution();

        const mockContributionProvider: ContributionProvider<ExternalRequestContribution> = {
            getContributions(): ExternalRequestContribution[] {
                return [{
                    onExternalRequest(request: ExternalRequest): void {
                        receivedRequests.push(request);
                    }
                }];
            }
        };
        (contribution as unknown as { contributions: ContributionProvider<ExternalRequestContribution> }).contributions = mockContributionProvider;
    });

    it('should forward external requests to contributions', async () => {
        const args = {
            _: [testSubDir, testFile],
            $0: 'theia'
        };
        await contribution.setArguments(args as never);

        assert.strictEqual(receivedRequests.length, 1);
        const request = receivedRequests[0];
        assert.ok(CliExternalRequest.is(request));
        assert.ok(request.raw.includes(testSubDir));
        assert.ok(request.raw.includes(testFile));
        assert.strictEqual(request.secondInstance, false);
    });

    it('should handle empty positional args', async () => {
        const args = {
            _: [],
            $0: 'theia'
        };
        await contribution.setArguments(args as never);

        assert.strictEqual(receivedRequests.length, 1);
        const request = receivedRequests[0];
        assert.ok(CliExternalRequest.is(request));
        assert.deepStrictEqual(request.raw, []);
        assert.deepStrictEqual(request.parameters, {});
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
                        onExternalRequest(request: ExternalRequest): void {
                            receivedRequests.push(request);
                        }
                    }
                ];
            }
        };
        (contribution as unknown as { contributions: ContributionProvider<ExternalRequestContribution> }).contributions = errorProvider;

        const args = {
            _: [],
            $0: 'theia'
        };
        await contribution.setArguments(args as never);

        assert.strictEqual(receivedRequests.length, 1);
    });
});
