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
import { AppRequest, AppRequestContribution, CliAppRequest } from '@theia/core/lib/common/app-request';
import { FileUri } from '@theia/core/lib/common/file-uri';
import { EditorManager, EditorOpenerOptions } from '../browser/editor-manager';

@injectable()
export class CliFileOpenContribution implements AppRequestContribution {

    @inject(EditorManager)
    protected readonly editorManager: EditorManager;

    async onAppRequest(request: AppRequest): Promise<void> {
        if (!CliAppRequest.is(request)) {
            return;
        }
        for (const target of CliAppRequest.files(request)) {
            const uri = FileUri.create(target.absolutePath);
            const options: EditorOpenerOptions | undefined = target.line !== undefined
                ? {
                    selection: {
                        start: {
                            line: Math.max(0, target.line - 1),
                            character: Math.max(0, (target.column ?? 1) - 1)
                        }
                    }
                }
                : undefined;
            await this.editorManager.open(uri, options);
        }
    }
}
