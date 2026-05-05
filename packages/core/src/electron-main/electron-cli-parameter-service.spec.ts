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
import { CliParameters } from '../common/cli-parameters';
import { ExternalRequest } from '../common/external-request';

/**
 * Standalone classify function that mirrors ElectronCliParameterService.classify()
 * for testing purposes without requiring Electron dependencies.
 */
async function classify(argv: string[], cwd: string, binIndex: number = 1): Promise<CliParameters> {
    const rawArgs = argv.slice(binIndex + 1);
    const directoryPaths: string[] = [];
    const filePaths: string[] = [];
    const genericParameters: string[] = [];

    for (let i = 0; i < rawArgs.length; i++) {
        const arg = rawArgs[i];

        // Skip --chat and its operand
        if (arg === '--chat') {
            genericParameters.push(arg);
            if (i + 1 < rawArgs.length) { genericParameters.push(rawArgs[++i]); }
            continue;
        }

        if (arg.startsWith('-')) {
            genericParameters.push(arg);
            continue;
        }

        // Strip file:line:col suffix before stat'ing
        const parsed = ExternalRequest.parseFileArg(arg);
        const resolved = path.resolve(cwd, parsed.path);
        try {
            const stat = await fs.stat(resolved);
            if (stat.isDirectory()) {
                directoryPaths.push(resolved);
            } else if (stat.isFile()) {
                filePaths.push(resolved);
            } else {
                genericParameters.push(arg);
            }
        } catch {
            genericParameters.push(arg);
        }
    }

    return {
        cwd,
        directoryPaths,
        filePaths,
        genericParameters,
        rawArgs,
        secondInstance: false
    };
}

describe('ElectronCliParameterService (classify logic)', () => {

    let tmpDir: string;
    let testFile: string;
    let testSubDir: string;

    before(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'theia-cli-test-'));
        testFile = path.join(tmpDir, 'test-file.ts');
        testSubDir = path.join(tmpDir, 'test-subdir');
        await fs.writeFile(testFile, 'content');
        await fs.mkdir(testSubDir);
    });

    after(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('should classify directory arguments', async () => {
        const argv = [process.execPath, 'app.js', testSubDir];
        const result = await classify(argv, tmpDir);

        assert.deepStrictEqual(result.directoryPaths, [testSubDir]);
        assert.deepStrictEqual(result.filePaths, []);
        assert.deepStrictEqual(result.genericParameters, []);
        assert.strictEqual(result.cwd, tmpDir);
        assert.strictEqual(result.secondInstance, false);
    });

    it('should classify file arguments', async () => {
        const argv = [process.execPath, 'app.js', testFile];
        const result = await classify(argv, tmpDir);

        assert.deepStrictEqual(result.directoryPaths, []);
        assert.deepStrictEqual(result.filePaths, [testFile]);
        assert.deepStrictEqual(result.genericParameters, []);
    });

    it('should classify file:line arguments as files', async () => {
        const argv = [process.execPath, 'app.js', testFile + ':42'];
        const result = await classify(argv, tmpDir);

        assert.deepStrictEqual(result.filePaths, [testFile]);
    });

    it('should classify file:line:col arguments as files', async () => {
        const argv = [process.execPath, 'app.js', testFile + ':42:10'];
        const result = await classify(argv, tmpDir);

        assert.deepStrictEqual(result.filePaths, [testFile]);
    });

    it('should classify flag arguments as generic parameters', async () => {
        const argv = [process.execPath, 'app.js', '--verbose', '--port=3000'];
        const result = await classify(argv, tmpDir);

        assert.deepStrictEqual(result.directoryPaths, []);
        assert.deepStrictEqual(result.filePaths, []);
        assert.deepStrictEqual(result.genericParameters, ['--verbose', '--port=3000']);
    });

    it('should classify non-existent paths as generic parameters', async () => {
        const argv = [process.execPath, 'app.js', '/nonexistent/path'];
        const result = await classify(argv, tmpDir);

        assert.deepStrictEqual(result.directoryPaths, []);
        assert.deepStrictEqual(result.filePaths, []);
        assert.deepStrictEqual(result.genericParameters, ['/nonexistent/path']);
    });

    it('should handle mixed arguments', async () => {
        const argv = [process.execPath, 'app.js', testSubDir, '--verbose', testFile, 'unknown'];
        const result = await classify(argv, tmpDir);

        assert.deepStrictEqual(result.directoryPaths, [testSubDir]);
        assert.deepStrictEqual(result.filePaths, [testFile]);
        assert.strictEqual(result.genericParameters.length, 2);
        assert.ok(result.genericParameters.includes('--verbose'));
        assert.ok(result.genericParameters.includes('unknown'));
    });

    it('should resolve relative paths against cwd', async () => {
        const argv = [process.execPath, 'app.js', 'test-file.ts'];
        const result = await classify(argv, tmpDir);

        assert.deepStrictEqual(result.filePaths, [testFile]);
    });

    it('should handle empty arguments', async () => {
        const argv = [process.execPath, 'app.js'];
        const result = await classify(argv, tmpDir);

        assert.deepStrictEqual(result.directoryPaths, []);
        assert.deepStrictEqual(result.filePaths, []);
        assert.deepStrictEqual(result.genericParameters, []);
        assert.deepStrictEqual(result.rawArgs, []);
    });

    it('should preserve raw args', async () => {
        const argv = [process.execPath, 'app.js', testSubDir, '--flag', testFile];
        const result = await classify(argv, tmpDir);

        assert.deepStrictEqual(result.rawArgs, [testSubDir, '--flag', testFile]);
    });

    it('should set secondInstance to false by default', async () => {
        const argv = [process.execPath, 'app.js'];
        const result = await classify(argv, tmpDir);

        assert.strictEqual(result.secondInstance, false);
    });

    it('should handle bundled app argv (binIndex=0)', async () => {
        const argv = ['app', testFile];
        const result = await classify(argv, tmpDir, 0);

        assert.deepStrictEqual(result.filePaths, [testFile]);
    });

    it('should skip --chat args during classification', async () => {
        const argv = [process.execPath, 'app.js', '--chat', 'Review this', testFile];
        const result = await classify(argv, tmpDir);

        assert.deepStrictEqual(result.filePaths, [testFile]);
        assert.ok(result.genericParameters.includes('--chat'));
        assert.ok(result.genericParameters.includes('Review this'));
    });
});
