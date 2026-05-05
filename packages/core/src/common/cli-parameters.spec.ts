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
import { isCliInvocationMessage } from './cli-parameters';

describe('cli-parameters (backwards compatibility)', () => {

    describe('isCliInvocationMessage', () => {
        it('should return true for valid external request messages', () => {
            const msg = {
                type: 'external-request',
                request: {
                    type: 'cli',
                    raw: [],
                    cwd: '/test',
                    secondInstance: false,
                    parameters: {}
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
            assert.strictEqual(isCliInvocationMessage('external-request'), false);
        });

        it('should return false for objects with wrong type', () => {
            assert.strictEqual(isCliInvocationMessage({ type: 'other' }), false);
        });

        it('should return false for objects without type', () => {
            assert.strictEqual(isCliInvocationMessage({ request: {} }), false);
        });
    });
});
