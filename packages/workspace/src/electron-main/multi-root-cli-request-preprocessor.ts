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

import * as path from 'path';
import * as fs from '@theia/core/shared/fs-extra';
import * as jsoncparser from 'jsonc-parser';
import { homedir } from 'os';
import { injectable } from '@theia/core/shared/inversify';
import { CliAppRequest, FileSystemTarget } from '@theia/core/lib/common/app-request';
import { CliRequestPreprocessor } from '@theia/core/lib/common/cli-request-preprocessor';
import { isWindows, isOSX } from '@theia/core/lib/common/os';

const UNTITLED_PREFIX = 'Untitled-';
const DEFAULT_WORKSPACE_EXTENSION = 'theia-workspace';
const APP_CONFIGURATION_FOLDER_FALLBACK = '.theia';

interface UntitledWorkspaceFile {
    folders?: { path: string }[];
}

@injectable()
export class MultiRootCliRequestPreprocessor implements CliRequestPreprocessor {

    async preprocess(request: CliAppRequest): Promise<CliAppRequest> {
        const directories = CliAppRequest.directories(request);
        if (directories.length < 2) {
            return request;
        }
        const folders = directories.map(d => d.absolutePath);
        const matched = await this.findExistingUntitledWorkspaceWithRoots(folders)
            ?? await this.createUntitledWorkspace(folders);
        if (!matched) {
            return request;
        }

        // Replace the directory targets with a single workspaceFile target,
        // preserving the order of any other entries (files, workspaceFiles).
        const newTargets: FileSystemTarget[] = [];
        let directoriesReplaced = false;
        for (const target of request.fileSystemTargets) {
            if (target.kind === 'directory') {
                if (!directoriesReplaced) {
                    newTargets.push({ kind: 'workspaceFile', absolutePath: matched });
                    directoriesReplaced = true;
                }
            } else {
                newTargets.push(target);
            }
        }
        return { ...request, fileSystemTargets: newTargets };
    }

    protected async findExistingUntitledWorkspaceWithRoots(folders: string[]): Promise<string | undefined> {
        const workspacesDir = await this.getWorkspacesDir();
        if (!await fs.pathExists(workspacesDir)) {
            return undefined;
        }
        const expected = this.canonicalFolders(folders);
        let entries: string[];
        try {
            entries = await fs.readdir(workspacesDir);
        } catch {
            return undefined;
        }
        for (const entry of entries) {
            if (!entry.startsWith(UNTITLED_PREFIX)) {
                continue;
            }
            const filePath = path.join(workspacesDir, entry);
            const candidateFolders = await this.readWorkspaceFolders(filePath);
            if (!candidateFolders) {
                continue;
            }
            const canonical = this.canonicalFolders(candidateFolders);
            if (this.foldersEqual(canonical, expected)) {
                return filePath;
            }
        }
        return undefined;
    }

    protected async createUntitledWorkspace(folders: string[]): Promise<string | undefined> {
        try {
            const workspacesDir = await this.getWorkspacesDir();
            await fs.ensureDir(workspacesDir);
            const filePath = await this.findUnusedUntitledWorkspaceFile(workspacesDir);
            const content = JSON.stringify({ folders: folders.map(f => ({ path: f })) }, undefined, 4);
            await fs.writeFile(filePath, content);
            return filePath;
        } catch {
            return undefined;
        }
    }

    protected async findUnusedUntitledWorkspaceFile(workspacesDir: string): Promise<string> {
        for (let attempts = 0; attempts < 50; attempts++) {
            const candidate = path.join(workspacesDir, `${UNTITLED_PREFIX}${Math.round(Math.random() * 1000)}.${DEFAULT_WORKSPACE_EXTENSION}`);
            if (!await fs.pathExists(candidate)) {
                return candidate;
            }
        }
        throw new Error('Unable to find an unused untitled workspace file name.');
    }

    protected async readWorkspaceFolders(filePath: string): Promise<string[] | undefined> {
        try {
            const raw = await fs.readFile(filePath, 'utf-8');
            const parsed: UntitledWorkspaceFile = jsoncparser.parse(jsoncparser.stripComments(raw));
            if (!parsed.folders) {
                return undefined;
            }
            return parsed.folders
                .map(f => f.path)
                .filter((p): p is string => typeof p === 'string');
        } catch {
            return undefined;
        }
    }

    protected canonicalFolders(folders: string[]): string[] {
        return folders.map(f => this.canonicalize(f)).sort();
    }

    protected foldersEqual(a: string[], b: string[]): boolean {
        if (a.length !== b.length) {
            return false;
        }
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) {
                return false;
            }
        }
        return true;
    }

    protected canonicalize(folderPath: string): string {
        let normalized = path.normalize(folderPath);
        if (normalized.length > 1 && (normalized.endsWith('/') || normalized.endsWith(path.sep))) {
            normalized = normalized.slice(0, -1);
        }
        return isWindows || isOSX ? normalized.toLowerCase() : normalized;
    }

    /**
     * Computes the same workspaces directory the backend uses (`<configDir>/workspaces`),
     * mirroring the logic of `EnvVariablesServerImpl.createConfigDirUri` without depending on it.
     */
    protected async getWorkspacesDir(): Promise<string> {
        const configDir = await this.getConfigDir();
        return path.join(configDir, 'workspaces');
    }

    protected async getConfigDir(): Promise<string> {
        if (process.env.THEIA_CONFIG_DIR) {
            return process.env.THEIA_CONFIG_DIR;
        }
        return path.join(homedir(), this.getConfigurationFolder());
    }

    /**
     * The application's configuration folder name. Mirrors the backend's
     * `BackendApplicationConfig.configurationFolder` for default Theia builds.
     * Adopters that override the configuration folder name (e.g. to brand the
     * application with a custom config dir) should subclass this preprocessor
     * and override this method.
     */
    protected getConfigurationFolder(): string {
        return APP_CONFIGURATION_FOLDER_FALLBACK;
    }
}
