/********************************************************************************
 * Copyright (C) 2021 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/
import { inject, injectable } from 'inversify';
import { Command, CommandContribution, CommandRegistry } from '../../common/command';
import { ApplicationShell } from '../shell';
import { Widget } from '../widgets';

export const EXTRACT_WIDGET = Command.toDefaultLocalizedCommand({
    id: 'extract-widget',
    label: 'Extract View'
});

export interface ExtractableWidget extends Widget {
    isExtractable: boolean;
}

export namespace ExtractableWidget {
    export function is(widget: unknown): widget is ExtractableWidget {
        return widget instanceof Widget && widget.hasOwnProperty('isExtractable') && typeof (widget as ExtractableWidget).isExtractable === 'boolean';
    }
}

@injectable()
export class ExtractWidgetCommandContribution implements CommandContribution {

    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(EXTRACT_WIDGET, {
            execute: async widget => {

                // sanity check
                if (!ExtractableWidget.is(widget)) {
                    // command executed with a non-extractable widget
                    console.error('Invalid command execution');
                }

                this.shell.moveWidgetToExternalWindow(widget);
            },
            isVisible: widget => ExtractableWidget.is(widget),
            isEnabled: widget => ExtractableWidget.is(widget)
        });
    }
}
