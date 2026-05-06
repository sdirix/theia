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

import { expect } from 'chai';
import { ElectronMainApplication } from './electron-main-application';
import { DEFAULT_WINDOW_HASH } from '../common/window';

interface FakeWindow {
    window: { webContents: { getURL(): string } };
}

function createTestableApp(fakeWindows: Map<number, FakeWindow>): {
    findWindowForWorkspace(workspacePath: string): FakeWindow | undefined
} {
    // Bypass the constructor (which initialises Electron-only state) and only
    // set the fields that `findWindowForWorkspace` actually reads.
    const instance = Object.create(ElectronMainApplication.prototype);
    instance.windows = fakeWindows;
    return instance;
}

function makeWindow(url: string): FakeWindow {
    return { window: { webContents: { getURL: () => url } } };
}

describe('ElectronMainApplication.findWindowForWorkspace', () => {

    it('returns the window with a matching fragment', () => {
        const w = makeWindow('file:///opt/theia/index.html?port=3000#/tmp/projectA');
        const app = createTestableApp(new Map([[1, w]]));
        expect(app.findWindowForWorkspace('/tmp/projectA')).to.equal(w);
    });

    it('does not match a window with the default empty hash', () => {
        const w = makeWindow(`file:///opt/theia/index.html?port=3000#${DEFAULT_WINDOW_HASH}`);
        const app = createTestableApp(new Map([[1, w]]));
        expect(app.findWindowForWorkspace('/tmp/projectA')).to.equal(undefined);
    });

    it('does not match a window with an empty fragment', () => {
        const w = makeWindow('file:///opt/theia/index.html?port=3000#');
        const app = createTestableApp(new Map([[1, w]]));
        expect(app.findWindowForWorkspace('/tmp/projectA')).to.equal(undefined);
    });

    it('returns the matching window when multiple windows are open', () => {
        const wa = makeWindow('file:///opt/theia/index.html?port=3000#/tmp/projectA');
        const wb = makeWindow('file:///opt/theia/index.html?port=3000#/tmp/projectB');
        const wc = makeWindow(`file:///opt/theia/index.html?port=3000#${DEFAULT_WINDOW_HASH}`);
        const app = createTestableApp(new Map([[1, wa], [2, wb], [3, wc]]));
        expect(app.findWindowForWorkspace('/tmp/projectB')).to.equal(wb);
        expect(app.findWindowForWorkspace('/tmp/projectA')).to.equal(wa);
    });

    it('matches across trailing-slash differences', () => {
        const w = makeWindow('file:///opt/theia/index.html?port=3000#/tmp/projectA/');
        const app = createTestableApp(new Map([[1, w]]));
        expect(app.findWindowForWorkspace('/tmp/projectA')).to.equal(w);
    });

    it('matches encoded fragments via decodeURI', () => {
        const w = makeWindow('file:///opt/theia/index.html?port=3000#/tmp/with%20space');
        const app = createTestableApp(new Map([[1, w]]));
        expect(app.findWindowForWorkspace('/tmp/with space')).to.equal(w);
    });
});
