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
import { promises as fs } from 'fs';
import * as fsExtra from 'fs-extra';
import { expect } from 'chai';
import { CliAppRequest, FileSystemTarget } from '@theia/core/lib/common/app-request';
import { MultiRootCliRequestPreprocessor } from './multi-root-cli-request-preprocessor';

class TestablePreprocessor extends MultiRootCliRequestPreprocessor {
    constructor(private readonly configDir: string) {
        super();
    }
    protected override async getConfigDir(): Promise<string> {
        return this.configDir;
    }
}

function buildRequest(targets: FileSystemTarget[]): CliAppRequest {
    return {
        kind: 'cli',
        raw: [],
        cwd: '/tmp',
        secondInstance: false,
        fileSystemTargets: targets,
        parameters: {}
    };
}

describe('MultiRootCliRequestPreprocessor', () => {

    let configDir: string;
    let workspacesDir: string;
    let preprocessor: TestablePreprocessor;

    beforeEach(async () => {
        configDir = await fs.mkdtemp(path.join(os.tmpdir(), 'multi-root-pre-'));
        workspacesDir = path.join(configDir, 'workspaces');
        preprocessor = new TestablePreprocessor(configDir);
    });

    afterEach(async () => {
        await fsExtra.remove(configDir);
    });

    it('returns the request unchanged when there is only a single directory', async () => {
        const request = buildRequest([{ kind: 'directory', absolutePath: '/tmp/A' }]);
        const result = await preprocessor.preprocess(request);
        expect(result.fileSystemTargets).to.deep.equal(request.fileSystemTargets);
    });

    it('creates a new untitled workspace when no existing match is found', async () => {
        const request = buildRequest([
            { kind: 'directory', absolutePath: '/tmp/A' },
            { kind: 'directory', absolutePath: '/tmp/B' }
        ]);
        const result = await preprocessor.preprocess(request);
        expect(result.fileSystemTargets).to.have.length(1);
        expect(result.fileSystemTargets[0].kind).to.equal('workspaceFile');
        const wsPath = (result.fileSystemTargets[0] as { absolutePath: string }).absolutePath;
        expect(path.dirname(wsPath)).to.equal(workspacesDir);
        expect(path.basename(wsPath).startsWith('Untitled-')).to.equal(true);
        const content = JSON.parse(await fs.readFile(wsPath, 'utf-8'));
        expect(content.folders).to.deep.equal([{ path: '/tmp/A' }, { path: '/tmp/B' }]);
    });

    it('reuses an existing untitled workspace with the same folders', async () => {
        await fsExtra.ensureDir(workspacesDir);
        const existingPath = path.join(workspacesDir, 'Untitled-7.theia-workspace');
        await fs.writeFile(existingPath, JSON.stringify({ folders: [{ path: '/tmp/A' }, { path: '/tmp/B' }] }));

        const request = buildRequest([
            { kind: 'directory', absolutePath: '/tmp/A' },
            { kind: 'directory', absolutePath: '/tmp/B' }
        ]);
        const result = await preprocessor.preprocess(request);
        expect(result.fileSystemTargets).to.have.length(1);
        expect((result.fileSystemTargets[0] as { absolutePath: string }).absolutePath).to.equal(existingPath);
        // No new file should have been created.
        const entries = await fs.readdir(workspacesDir);
        expect(entries).to.deep.equal(['Untitled-7.theia-workspace']);
    });

    it('matches existing untitled workspace regardless of folder order', async () => {
        await fsExtra.ensureDir(workspacesDir);
        const existingPath = path.join(workspacesDir, 'Untitled-99.theia-workspace');
        await fs.writeFile(existingPath, JSON.stringify({ folders: [{ path: '/tmp/B' }, { path: '/tmp/A' }] }));

        const request = buildRequest([
            { kind: 'directory', absolutePath: '/tmp/A' },
            { kind: 'directory', absolutePath: '/tmp/B' }
        ]);
        const result = await preprocessor.preprocess(request);
        expect((result.fileSystemTargets[0] as { absolutePath: string }).absolutePath).to.equal(existingPath);
    });

    it('preserves a file target while collapsing directories', async () => {
        const request = buildRequest([
            { kind: 'directory', absolutePath: '/tmp/A' },
            { kind: 'directory', absolutePath: '/tmp/B' },
            { kind: 'file', absolutePath: '/tmp/A/foo.ts', line: 5 }
        ]);
        const result = await preprocessor.preprocess(request);
        expect(result.fileSystemTargets).to.have.length(2);
        expect(result.fileSystemTargets[0].kind).to.equal('workspaceFile');
        expect(result.fileSystemTargets[1].kind).to.equal('file');
    });

    it('handles three directories mixed with a file', async () => {
        const request = buildRequest([
            { kind: 'directory', absolutePath: '/tmp/A' },
            { kind: 'directory', absolutePath: '/tmp/B' },
            { kind: 'directory', absolutePath: '/tmp/C' },
            { kind: 'file', absolutePath: '/tmp/A/foo.ts' }
        ]);
        const result = await preprocessor.preprocess(request);
        expect(result.fileSystemTargets).to.have.length(2);
        expect(result.fileSystemTargets[0].kind).to.equal('workspaceFile');
        expect(result.fileSystemTargets[1].kind).to.equal('file');
        const wsPath = (result.fileSystemTargets[0] as { absolutePath: string }).absolutePath;
        const content = JSON.parse(await fs.readFile(wsPath, 'utf-8'));
        expect(content.folders).to.deep.equal([{ path: '/tmp/A' }, { path: '/tmp/B' }, { path: '/tmp/C' }]);
    });
});
