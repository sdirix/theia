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

import { inject, injectable } from '@theia/core/shared/inversify';
import { ExternalRequest, CliExternalRequest, ExternalRequestContribution } from '@theia/core/lib/common/external-request';
import { FileUri } from '@theia/core/lib/common/file-uri';
import { Path } from '@theia/core/lib/common/path';
import { EditorManager, EditorOpenerOptions } from './editor-manager';

/**
 * Opens editors for file-path parameters received from external requests.
 * Supports `file:line:col` syntax for opening at a specific position.
 */
@injectable()
export class CliFileOpenContribution implements ExternalRequestContribution {

    @inject(EditorManager)
    protected readonly editorManager: EditorManager;

    async onExternalRequest(request: ExternalRequest): Promise<void> {
        if (!CliExternalRequest.is(request)) {
            return;
        }
        const targets = CliExternalRequest.parseFileTargets(request);
        const cwd = request.cwd;
        for (const target of targets) {
            const resolvedPath = this.resolvePath(target.path, cwd);
            const uri = FileUri.create(resolvedPath);
            const options: EditorOpenerOptions = {};
            if (target.line !== undefined) {
                options.selection = {
                    start: {
                        line: target.line - 1,
                        character: target.column ? target.column - 1 : 0
                    }
                };
            }
            await this.editorManager.open(uri, options);
        }
    }

    protected resolvePath(targetPath: string, cwd: string): string {
        if (new Path(targetPath).isAbsolute) {
            return targetPath;
        }
        return new Path(cwd).join(targetPath).toString();
    }
}
