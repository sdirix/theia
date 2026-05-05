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
import { CliExternalRequest } from '../common/external-request';

/**
 * Standalone classify function that mirrors ElectronCliParameterService.classify()
 * for testing purposes without requiring Electron dependencies.
 */
async function classify(argv: string[], cwd: string, binIndex: number = 1): Promise<CliExternalRequest> {
    const raw = argv.slice(binIndex + 1);
    const parameters = CliExternalRequest.parseParameters(raw);

    let directory: string | undefined;
    let file: string | undefined;

    for (let i = 0; i < raw.length; i++) {
        const arg = raw[i];

        // Skip flags; also skip consumed value for flags with string parameters
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            if (typeof parameters[key] === 'string') { i++; }
            continue;
        }

        if (arg.startsWith('-')) {
            continue;
        }

        // Positional arg — classify via fs.stat
        const parsed = CliExternalRequest.parseFileArg(arg);
        const resolved = path.resolve(cwd, parsed.path);
        try {
            const stat = await fs.stat(resolved);
            if (stat.isDirectory() && !directory) {
                directory = resolved;
            } else if (stat.isFile() && !file) {
                file = resolved;
            }
        } catch {
            // not a valid path, ignore
        }
    }

    return {
        type: 'cli',
        raw,
        cwd,
        secondInstance: false,
        directory,
        file,
        parameters
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
        const result = await classify([process.execPath, 'app.js', testSubDir], tmpDir);

        assert.strictEqual(result.type, 'cli');
        assert.strictEqual(result.directory, testSubDir);
        assert.strictEqual(result.file, undefined);
        assert.strictEqual(result.cwd, tmpDir);
        assert.strictEqual(result.secondInstance, false);
    });

    it('should classify file arguments', async () => {
        const result = await classify([process.execPath, 'app.js', testFile], tmpDir);

        assert.strictEqual(result.directory, undefined);
        assert.strictEqual(result.file, testFile);
    });

    it('should classify file:line arguments as files', async () => {
        const result = await classify([process.execPath, 'app.js', testFile + ':42'], tmpDir);

        assert.strictEqual(result.file, testFile);
    });

    it('should classify file:line:col arguments as files', async () => {
        const result = await classify([process.execPath, 'app.js', testFile + ':42:10'], tmpDir);

        assert.strictEqual(result.file, testFile);
    });

    it('should classify flag arguments as parameters', async () => {
        const result = await classify([process.execPath, 'app.js', '--verbose', '--port', '3000'], tmpDir);

        assert.strictEqual(result.directory, undefined);
        assert.strictEqual(result.file, undefined);
        assert.deepStrictEqual(result.parameters, { verbose: true, port: '3000' });
    });

    it('should classify non-existent paths (ignored, no dir/file set)', async () => {
        const result = await classify([process.execPath, 'app.js', '/nonexistent/path'], tmpDir);

        assert.strictEqual(result.directory, undefined);
        assert.strictEqual(result.file, undefined);
    });

    it('should handle mixed arguments', async () => {
        const result = await classify([process.execPath, 'app.js', testSubDir, testFile, '--verbose'], tmpDir);

        assert.strictEqual(result.directory, testSubDir);
        assert.strictEqual(result.file, testFile);
        assert.deepStrictEqual(result.parameters, { verbose: true });
    });

    it('should resolve relative paths against cwd', async () => {
        const result = await classify([process.execPath, 'app.js', 'test-file.ts'], tmpDir);

        assert.strictEqual(result.file, testFile);
    });

    it('should handle empty arguments', async () => {
        const result = await classify([process.execPath, 'app.js'], tmpDir);

        assert.strictEqual(result.directory, undefined);
        assert.strictEqual(result.file, undefined);
        assert.deepStrictEqual(result.raw, []);
        assert.deepStrictEqual(result.parameters, {});
    });

    it('should preserve raw args', async () => {
        const result = await classify([process.execPath, 'app.js', testSubDir, '--flag', testFile], tmpDir);

        assert.deepStrictEqual(result.raw, [testSubDir, '--flag', testFile]);
    });

    it('should set secondInstance to false by default', async () => {
        const result = await classify([process.execPath, 'app.js'], tmpDir);

        assert.strictEqual(result.secondInstance, false);
    });

    it('should handle bundled app argv (binIndex=0)', async () => {
        const result = await classify(['app', testFile], tmpDir, 0);

        assert.strictEqual(result.file, testFile);
    });

    it('should skip --chat args during classification', async () => {
        const result = await classify([process.execPath, 'app.js', '--chat', 'Review this', testFile], tmpDir);

        assert.strictEqual(result.file, testFile);
        assert.strictEqual(result.parameters.chat, 'Review this');
    });

    it('should populate parameters for flags with values', async () => {
        const result = await classify([process.execPath, 'app.js', '--chat', 'hello world', '--verbose'], tmpDir);

        assert.deepStrictEqual(result.parameters, { chat: 'hello world', verbose: true });
    });
});
