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
import { isCliInvocationMessage, CliParameters } from './cli-parameters';

describe('cli-parameters', () => {

    describe('isCliInvocationMessage', () => {
        it('should return true for valid CLI invocation messages', () => {
            const msg = {
                type: 'cli-invocation',
                cliParameters: {
                    cwd: '/test',
                    directoryPaths: [],
                    filePaths: [],
                    genericParameters: [],
                    rawArgs: [],
                    secondInstance: false
                }
            };
            assert.strictEqual(isCliInvocationMessage(msg), true);
        });

        it('should return false for null', () => {
            // eslint-disable-next-line no-null/no-null
            assert.strictEqual(isCliInvocationMessage(null), false);
        });

        it('should return false for undefined', () => {
            assert.strictEqual(isCliInvocationMessage(undefined), false);
        });

        it('should return false for strings', () => {
            assert.strictEqual(isCliInvocationMessage('cli-invocation'), false);
        });

        it('should return false for objects with wrong type', () => {
            assert.strictEqual(isCliInvocationMessage({ type: 'other' }), false);
        });

        it('should return false for objects without type', () => {
            assert.strictEqual(isCliInvocationMessage({ cliParameters: {} }), false);
        });
    });

    describe('CliParameters interface', () => {
        it('should represent initial launch parameters', () => {
            const params: CliParameters = {
                cwd: '/home/user',
                directoryPaths: ['/home/user/project'],
                filePaths: ['/home/user/project/file.ts'],
                genericParameters: ['--verbose'],
                rawArgs: ['/home/user/project', '--verbose', '/home/user/project/file.ts'],
                secondInstance: false
            };
            assert.strictEqual(params.secondInstance, false);
            assert.strictEqual(params.directoryPaths.length, 1);
            assert.strictEqual(params.filePaths.length, 1);
            assert.strictEqual(params.genericParameters.length, 1);
        });

        it('should represent second-instance parameters', () => {
            const params: CliParameters = {
                cwd: '/home/user',
                directoryPaths: [],
                filePaths: [],
                genericParameters: [],
                rawArgs: [],
                secondInstance: true
            };
            assert.strictEqual(params.secondInstance, true);
        });
    });
});
