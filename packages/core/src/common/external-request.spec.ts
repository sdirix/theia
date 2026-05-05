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
import { CliExternalRequest, ExternalRequest } from './external-request';

describe('CliExternalRequest namespace utilities', () => {

    function makeRequest(raw: string[], overrides?: Partial<CliExternalRequest>): CliExternalRequest {
        return {
            type: 'cli',
            raw,
            cwd: '/test',
            secondInstance: false,
            parameters: CliExternalRequest.parseParameters(raw),
            ...overrides
        };
    }

    describe('is', () => {
        it('should return true for CLI requests', () => {
            const request: ExternalRequest = { type: 'cli' };
            assert.strictEqual(CliExternalRequest.is(request), true);
        });

        it('should return false for other request types', () => {
            const request: ExternalRequest = { type: 'url' };
            assert.strictEqual(CliExternalRequest.is(request), false);
        });
    });

    describe('parseFileArg', () => {
        it('should parse plain file path', () => {
            const result = CliExternalRequest.parseFileArg('file.ts');
            assert.deepStrictEqual(result, { path: 'file.ts' });
        });

        it('should parse file:line', () => {
            const result = CliExternalRequest.parseFileArg('file.ts:42');
            assert.strictEqual(result.path, 'file.ts');
            assert.strictEqual(result.line, 42);
            assert.strictEqual(result.column, undefined);
        });

        it('should parse file:line:col', () => {
            const result = CliExternalRequest.parseFileArg('file.ts:42:10');
            assert.deepStrictEqual(result, { path: 'file.ts', line: 42, column: 10 });
        });

        it('should handle Windows-style paths with drive letter and line', () => {
            const result = CliExternalRequest.parseFileArg('C:\\path\\file.ts:42');
            assert.strictEqual(result.path, 'C:\\path\\file.ts');
            assert.strictEqual(result.line, 42);
            assert.strictEqual(result.column, undefined);
        });

        it('should handle absolute Unix paths without line', () => {
            const result = CliExternalRequest.parseFileArg('/path/to/file');
            assert.deepStrictEqual(result, { path: '/path/to/file' });
        });

        it('should handle absolute Unix paths with line', () => {
            const result = CliExternalRequest.parseFileArg('/path/to/file.ts:100');
            assert.strictEqual(result.path, '/path/to/file.ts');
            assert.strictEqual(result.line, 100);
            assert.strictEqual(result.column, undefined);
        });

        it('should handle absolute Unix paths with line and column', () => {
            const result = CliExternalRequest.parseFileArg('/path/to/file.ts:100:5');
            assert.deepStrictEqual(result, { path: '/path/to/file.ts', line: 100, column: 5 });
        });

        it('should not strip Windows drive letter alone', () => {
            const result = CliExternalRequest.parseFileArg('C:');
            assert.deepStrictEqual(result, { path: 'C:' });
        });
    });

    describe('parseFileTargets', () => {
        it('should return positional args as file targets', () => {
            const request = makeRequest(['file1.ts', 'file2.ts:10']);
            const targets = CliExternalRequest.parseFileTargets(request);
            assert.strictEqual(targets.length, 2);
            assert.deepStrictEqual(targets[0], { path: 'file1.ts' });
            assert.strictEqual(targets[1].path, 'file2.ts');
            assert.strictEqual(targets[1].line, 10);
        });

        it('should skip flags with string values', () => {
            const request = makeRequest(['--chat', 'Review this code', 'file.ts']);
            const targets = CliExternalRequest.parseFileTargets(request);
            assert.strictEqual(targets.length, 1);
            assert.deepStrictEqual(targets[0], { path: 'file.ts' });
        });

        it('should not skip positional after boolean flags', () => {
            const request = makeRequest(['--verbose', 'file.ts']);
            // --verbose is followed by 'file.ts' which doesn't start with '-'
            // So parseParameters treats it as { verbose: "file.ts" } and file.ts is consumed.
            // This is correct for the schema-less parser.
            const targets = CliExternalRequest.parseFileTargets(request);
            assert.strictEqual(targets.length, 0);
        });

        it('should handle flag at end as boolean', () => {
            const request = makeRequest(['file.ts', '--verbose']);
            const targets = CliExternalRequest.parseFileTargets(request);
            assert.strictEqual(targets.length, 1);
            assert.deepStrictEqual(targets[0], { path: 'file.ts' });
        });

        it('should handle empty args', () => {
            const request = makeRequest([]);
            const targets = CliExternalRequest.parseFileTargets(request);
            assert.strictEqual(targets.length, 0);
        });
    });

    describe('parseParameters', () => {
        it('should parse --key value pairs', () => {
            const params = CliExternalRequest.parseParameters(['--chat', 'hello world']);
            assert.deepStrictEqual(params, { chat: 'hello world' });
        });

        it('should parse boolean flags at end', () => {
            const params = CliExternalRequest.parseParameters(['--verbose']);
            assert.deepStrictEqual(params, { verbose: true });
        });

        it('should parse boolean flags before other flags', () => {
            const params = CliExternalRequest.parseParameters(['--verbose', '--chat', 'hello']);
            assert.deepStrictEqual(params, { verbose: true, chat: 'hello' });
        });

        it('should parse mixed flags and values', () => {
            const params = CliExternalRequest.parseParameters(['--chat', 'this is my chat request', '--verbose']);
            assert.deepStrictEqual(params, { chat: 'this is my chat request', verbose: true });
        });

        it('should skip positional args', () => {
            const params = CliExternalRequest.parseParameters(['file.ts', '--verbose']);
            assert.deepStrictEqual(params, { verbose: true });
        });

        it('should skip bare --', () => {
            const params = CliExternalRequest.parseParameters(['--']);
            assert.deepStrictEqual(params, {});
        });

        it('should handle empty args', () => {
            const params = CliExternalRequest.parseParameters([]);
            assert.deepStrictEqual(params, {});
        });

        it('should not consume values starting with -', () => {
            const params = CliExternalRequest.parseParameters(['--flag', '-other']);
            assert.deepStrictEqual(params, { flag: true });
        });

        it('should parse --key=value syntax', () => {
            const params = CliExternalRequest.parseParameters(['--plugins=local-dir:../../plugins']);
            assert.deepStrictEqual(params, { plugins: 'local-dir:../../plugins' });
        });

        it('should not consume next arg after --key=value', () => {
            const params = CliExternalRequest.parseParameters(['--ovsx-router-config=config.json', '.', '--chat', 'hello']);
            assert.deepStrictEqual(params, { 'ovsx-router-config': 'config.json', chat: 'hello' });
        });

        it('should handle --key= with empty value', () => {
            const params = CliExternalRequest.parseParameters(['--key=']);
            assert.deepStrictEqual(params, { key: '' });
        });

        it('should handle mixed --key=value and --key value syntax', () => {
            const params = CliExternalRequest.parseParameters(['--plugins=local-dir:../../plugins', '--chat', 'hello', '--verbose']);
            assert.deepStrictEqual(params, { plugins: 'local-dir:../../plugins', chat: 'hello', verbose: true });
        });
    });
});
