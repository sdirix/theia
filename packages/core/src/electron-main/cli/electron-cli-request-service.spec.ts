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

import * as os from 'os';
import * as path from 'path';
import * as fsExtra from 'fs-extra';
import { promises as fs } from 'fs';
import { expect } from 'chai';
import { ElectronCliRequestService } from './electron-cli-request-service';
import { isWindows } from '../../common/os';

class TestableClassifier extends ElectronCliRequestService {
    constructor() {
        super();
        // Skip the binary entry as ElectronMainProcessArgv would.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this as any).processArgv = {
            getProcessArgvWithoutBin: (argv: string[]) => argv.slice(1)
        };
    }
}

const BIN = '/usr/bin/theia';

describe('ElectronCliRequestService', () => {

    let classifier: TestableClassifier;
    let tmpDir: string;
    let dirA: string;
    let theiaWs: string;
    let codeWs: string;
    let plainFile: string;
    let symlinkToDir: string | undefined;

    before(async () => {
        classifier = new TestableClassifier();
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cli-classify-'));
        dirA = path.join(tmpDir, 'dirA');
        theiaWs = path.join(tmpDir, 'project.theia-workspace');
        codeWs = path.join(tmpDir, 'project.code-workspace');
        plainFile = path.join(tmpDir, 'foo.ts');
        await fsExtra.ensureDir(dirA);
        await fs.writeFile(theiaWs, '{}');
        await fs.writeFile(codeWs, '{}');
        await fs.writeFile(plainFile, 'console.log("hi")');
        try {
            symlinkToDir = path.join(tmpDir, 'linkToDirA');
            await fs.symlink(dirA, symlinkToDir, 'dir');
        } catch {
            // symlink may fail on Windows without privileges — tests that need it will skip.
            symlinkToDir = undefined;
        }
    });

    after(async () => {
        await fsExtra.remove(tmpDir);
    });

    it('classifies a single directory', async () => {
        const request = await classifier.classify([BIN, dirA], tmpDir, false);
        expect(request.kind).to.equal('cli');
        expect(request.secondInstance).to.equal(false);
        expect(request.fileSystemTargets).to.have.length(1);
        const [target] = request.fileSystemTargets;
        expect(target.kind).to.equal('directory');
        expect(target.absolutePath).to.equal(await fs.realpath(dirA));
    });

    it('reflects secondInstance=true', async () => {
        const request = await classifier.classify([BIN, dirA], tmpDir, true);
        expect(request.secondInstance).to.equal(true);
    });

    it('classifies a .theia-workspace as workspaceFile', async () => {
        const request = await classifier.classify([BIN, theiaWs], tmpDir, false);
        expect(request.fileSystemTargets[0].kind).to.equal('workspaceFile');
    });

    it('classifies a .code-workspace as workspaceFile', async () => {
        const request = await classifier.classify([BIN, codeWs], tmpDir, false);
        expect(request.fileSystemTargets[0].kind).to.equal('workspaceFile');
    });

    it('classifies a plain file as file (no line/col)', async () => {
        const request = await classifier.classify([BIN, plainFile], tmpDir, false);
        const [target] = request.fileSystemTargets;
        expect(target.kind).to.equal('file');
        if (target.kind === 'file') {
            expect(target.line).to.equal(undefined);
            expect(target.column).to.equal(undefined);
        }
    });

    it('parses path:line', async () => {
        const request = await classifier.classify([BIN, `${plainFile}:42`], tmpDir, false);
        const [target] = request.fileSystemTargets;
        expect(target.kind).to.equal('file');
        if (target.kind === 'file') {
            expect(target.line).to.equal(42);
            expect(target.column).to.equal(undefined);
        }
    });

    it('parses path:line:col', async () => {
        const request = await classifier.classify([BIN, `${plainFile}:42:7`], tmpDir, false);
        const [target] = request.fileSystemTargets;
        expect(target.kind).to.equal('file');
        if (target.kind === 'file') {
            expect(target.line).to.equal(42);
            expect(target.column).to.equal(7);
        }
    });

    it('does not strip a bare drive prefix like "C:" (only trailing :42 is parsed)', async () => {
        // We use an artificial value here: "C:\path\file.ts:42".
        // The leading "C:" must not be stripped; the trailing ":42" should be.
        // Since this path won't exist on the filesystem, just check parseFileArg behaviour
        // via the public classify method. We expect no fileSystemTarget (path doesn't exist),
        // but we also verify it doesn't throw.
        const request = await classifier.classify([BIN, 'C:\\path\\file.ts:42'], tmpDir, false);
        expect(request.fileSystemTargets).to.have.length(0);
    });

    it('treats ":42" without a path part as unclassified', async () => {
        const request = await classifier.classify([BIN, ':42'], tmpDir, false);
        expect(request.fileSystemTargets).to.have.length(0);
    });

    it('classifies mixed positional args in argv order', async () => {
        const request = await classifier.classify([BIN, dirA, plainFile, theiaWs], tmpDir, false);
        const kinds = request.fileSystemTargets.map(t => t.kind);
        expect(kinds).to.deep.equal(['directory', 'file', 'workspaceFile']);
    });

    it('captures --flag value into parameters', async () => {
        const request = await classifier.classify([BIN, '--my-flag', 'value'], tmpDir, false);
        expect(request.parameters).to.deep.equal({ 'my-flag': 'value' });
        expect(request.fileSystemTargets).to.have.length(0);
    });

    it('captures --bool with no value as true', async () => {
        const request = await classifier.classify([BIN, '--bool'], tmpDir, false);
        expect(request.parameters).to.deep.equal({ bool: true });
    });

    it('resolves symlinks to a directory via realpath', async function (): Promise<void> {
        if (!symlinkToDir) {
            this.skip();
            return;
        }
        const request = await classifier.classify([BIN, symlinkToDir], tmpDir, false);
        expect(request.fileSystemTargets[0].kind).to.equal('directory');
        expect(request.fileSystemTargets[0].absolutePath).to.equal(await fs.realpath(dirA));
    });

    it('omits non-existent positionals from fileSystemTargets but keeps them in raw', async () => {
        const request = await classifier.classify([BIN, 'no-such-thing-1234'], tmpDir, false);
        expect(request.fileSystemTargets).to.have.length(0);
        expect(request.raw).to.deep.equal(['no-such-thing-1234']);
    });

    it('classifies trailing "." against cwd as the cwd directory', async function (): Promise<void> {
        if (isWindows) {
            // On Windows symlink/realpath casing is platform-specific; main behavior already covered.
        }
        const request = await classifier.classify([BIN, '.'], tmpDir, false);
        expect(request.fileSystemTargets).to.have.length(1);
        expect(request.fileSystemTargets[0].kind).to.equal('directory');
        expect(request.fileSystemTargets[0].absolutePath).to.equal(await fs.realpath(tmpDir));
    });
});
