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
import { ExternalRequest } from './external-request';

describe('ExternalRequest namespace utilities', () => {

    describe('parseFileArg', () => {
        it('should parse plain file path', () => {
            const result = ExternalRequest.parseFileArg('file.ts');
            assert.deepStrictEqual(result, { path: 'file.ts' });
        });

        it('should parse file:line', () => {
            const result = ExternalRequest.parseFileArg('file.ts:42');
            assert.strictEqual(result.path, 'file.ts');
            assert.strictEqual(result.line, 42);
            assert.strictEqual(result.column, undefined);
        });

        it('should parse file:line:col', () => {
            const result = ExternalRequest.parseFileArg('file.ts:42:10');
            assert.deepStrictEqual(result, { path: 'file.ts', line: 42, column: 10 });
        });

        it('should handle Windows-style paths with drive letter and line', () => {
            const result = ExternalRequest.parseFileArg('C:\\path\\file.ts:42');
            assert.strictEqual(result.path, 'C:\\path\\file.ts');
            assert.strictEqual(result.line, 42);
            assert.strictEqual(result.column, undefined);
        });

        it('should handle absolute Unix paths without line', () => {
            const result = ExternalRequest.parseFileArg('/path/to/file');
            assert.deepStrictEqual(result, { path: '/path/to/file' });
        });

        it('should handle absolute Unix paths with line', () => {
            const result = ExternalRequest.parseFileArg('/path/to/file.ts:100');
            assert.strictEqual(result.path, '/path/to/file.ts');
            assert.strictEqual(result.line, 100);
            assert.strictEqual(result.column, undefined);
        });

        it('should handle absolute Unix paths with line and column', () => {
            const result = ExternalRequest.parseFileArg('/path/to/file.ts:100:5');
            assert.deepStrictEqual(result, { path: '/path/to/file.ts', line: 100, column: 5 });
        });

        it('should not strip Windows drive letter alone', () => {
            // Edge case: "C:" by itself should not be treated as line number
            const result = ExternalRequest.parseFileArg('C:');
            // "C:" has no digits after colon so no match
            assert.deepStrictEqual(result, { path: 'C:' });
        });
    });

    describe('parseFileTargets', () => {
        it('should return positional args as file targets', () => {
            const request: ExternalRequest = { rawArgs: ['file1.ts', 'file2.ts:10'] };
            const targets = ExternalRequest.parseFileTargets(request);
            assert.strictEqual(targets.length, 2);
            assert.deepStrictEqual(targets[0], { path: 'file1.ts' });
            assert.strictEqual(targets[1].path, 'file2.ts');
            assert.strictEqual(targets[1].line, 10);
        });

        it('should skip flags', () => {
            const request: ExternalRequest = { rawArgs: ['--verbose', 'file.ts'] };
            const targets = ExternalRequest.parseFileTargets(request);
            assert.strictEqual(targets.length, 1);
            assert.deepStrictEqual(targets[0], { path: 'file.ts' });
        });

        it('should skip --chat and its value', () => {
            const request: ExternalRequest = { rawArgs: ['--chat', 'Review this code', 'file.ts'] };
            const targets = ExternalRequest.parseFileTargets(request);
            assert.strictEqual(targets.length, 1);
            assert.deepStrictEqual(targets[0], { path: 'file.ts' });
        });

        it('should handle empty args', () => {
            const request: ExternalRequest = { rawArgs: [] };
            const targets = ExternalRequest.parseFileTargets(request);
            assert.strictEqual(targets.length, 0);
        });
    });

    describe('getFlag', () => {
        it('should get value after flag', () => {
            const request: ExternalRequest = { rawArgs: ['--chat', 'hello world'] };
            assert.strictEqual(ExternalRequest.getFlag(request, '--chat'), 'hello world');
        });

        it('should return undefined if flag not present', () => {
            const request: ExternalRequest = { rawArgs: ['file.ts'] };
            assert.strictEqual(ExternalRequest.getFlag(request, '--chat'), undefined);
        });

        it('should return undefined if flag is last arg', () => {
            const request: ExternalRequest = { rawArgs: ['--chat'] };
            assert.strictEqual(ExternalRequest.getFlag(request, '--chat'), undefined);
        });
    });

    describe('hasFlag', () => {
        it('should return true if flag present', () => {
            const request: ExternalRequest = { rawArgs: ['--verbose', 'file.ts'] };
            assert.strictEqual(ExternalRequest.hasFlag(request, '--verbose'), true);
        });

        it('should return false if flag not present', () => {
            const request: ExternalRequest = { rawArgs: ['file.ts'] };
            assert.strictEqual(ExternalRequest.hasFlag(request, '--verbose'), false);
        });
    });
});
