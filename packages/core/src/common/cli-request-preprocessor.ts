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

import { CliAppRequest } from './app-request';
import { MaybePromise } from './types';

/**
 * Pre-dispatch hook that transforms a CliAppRequest before
 * ElectronMainApplication.handleCliRequest acts on it. Multi-root
 * assembly is the canonical use case: a request with multiple directory
 * targets is rewritten into a request with a single workspace-file target.
 */
export const CliRequestPreprocessor = Symbol('CliRequestPreprocessor');
export interface CliRequestPreprocessor {
    preprocess(request: CliAppRequest): MaybePromise<CliAppRequest>;
}
