// *****************************************************************************
// Copyright (C) 2020 Ericsson and others.
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

import { injectable } from 'inversify';

// Extracted and modified the functionality from `yargs@15.4.0-beta.0`.
// Based on https://github.com/yargs/yargs/blob/522b019c9a50924605986a1e6e0cb716d47bcbca/lib/process-argv.ts
@injectable()
export class ElectronMainProcessArgv {

    protected get processArgvBinIndex(): number {
        // The binary name is the first command line argument for:
        // - bundled Electron apps: bin argv1 argv2 ... argvn
        if (this.isBundledElectronApp) {
            return 0;
        }
        // or the second one (default) for:
        // - standard node apps: node bin.js argv1 argv2 ... argvn
        // - unbundled Electron apps: electron bin.js argv1 arg2 ... argvn
        return 1;
    }

    get isBundledElectronApp(): boolean {
        // process.defaultApp is either set by electron in an electron unbundled app, or undefined
        // see https://github.com/electron/electron/blob/master/docs/api/process.md#processdefaultapp-readonly
        return this.isElectronApp && !(process as ElectronMainProcessArgv.ElectronMainProcess).defaultApp;
    }

    get isElectronApp(): boolean {
        // process.versions.electron is either set by electron, or undefined
        // see https://github.com/electron/electron/blob/master/docs/api/process.md#processversionselectron-readonly
        return !!(process as ElectronMainProcessArgv.ElectronMainProcess).versions.electron;
    }

    getProcessArgvWithoutBin(argv = process.argv): Array<string> {
        return argv.slice(this.processArgvBinIndex + 1);
    }

    getProcessArgvBin(argv = process.argv): string {
        return argv[this.processArgvBinIndex];
    }

}

export namespace ElectronMainProcessArgv {
    export interface ElectronMainProcess extends NodeJS.Process {
        readonly defaultApp: boolean;
        readonly versions: NodeJS.ProcessVersions & {
            readonly electron: string;
        };
    }
}
