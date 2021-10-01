/********************************************************************************
 * Copyright (C) 2020 TORO Limited and others.
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

import { ExternalPanelsHandler, QuickInputService } from '@theia/core/lib/browser';
import {
    Command, CommandContribution, CommandRegistry, MAIN_MENU_BAR,
    MenuContribution, MenuModelRegistry, MenuNode, MessageService, SubMenuOptions
} from '@theia/core/lib/common';
import { inject, injectable, interfaces } from '@theia/core/shared/inversify';
import { GettingStartedWidget } from '@theia/getting-started/lib/browser/getting-started-widget';

import { externalLoadVsRequire, loadMonaco } from '@theia/monaco/lib/browser/monaco-loader';

const NewSubWindow: Command = {
    id: 'new-sub-window',
    label: 'Move currently active view to new window'
};

const SampleCommand: Command = {
    id: 'sample-command',
    label: 'Sample Command'
};
const SampleCommand2: Command = {
    id: 'sample-command2',
    label: 'Sample Command2'
};
const SampleQuickInputCommand: Command = {
    id: 'sample-quick-input-command',
    category: 'Quick Input',
    label: 'Test Positive Integer'
};

@injectable()
export class SampleCommandContribution implements CommandContribution {

    @inject(QuickInputService)
    protected readonly quickInputService: QuickInputService;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    @inject(GettingStartedWidget)
    protected readonly gettingStartedWidget: GettingStartedWidget;

    @inject(ExternalPanelsHandler)
    protected readonly externalPanelsHandler: ExternalPanelsHandler;

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NewSubWindow, {
            execute: async () => {

                // Use different ids here for more than one secondary window
                const subWindow = window.open('', 'SubView');

                if (!subWindow) {
                    console.error('Was not able to create a sub window');
                    return;
                }

                console.log('Prepare window');
                const windowNeedsToBePrepared = this.externalPanelsHandler.prepareWindow(subWindow);

                if (windowNeedsToBePrepared) {
                    console.log('Window needs to be prepared');

                    const LOAD_MONACO = true;
                    // Load Monaco in secondary window to get the Monaco CSS.
                    if (LOAD_MONACO) {
                        console.log('Add VS Code require to the window');
                        const amdRequireInExtWindow = await externalLoadVsRequire(subWindow);
                        console.log('Load monaco');
                        await loadMonaco(amdRequireInExtWindow, subWindow);
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const subWindowColorRegistry = (subWindow as any).monaco.color.getColorRegistry();
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (window as any).monaco.color.getColorRegistry().getColors().forEach((ce: any) => {
                            subWindowColorRegistry.registerColor(ce.id, ce.defaults, ce.description);
                        });
                    }
                    console.log('Create root panel in secondary window');
                    this.externalPanelsHandler.createPanelInExternalWindow(subWindow);
                    console.log('Finished preparing window');
                } else {
                    console.log('Window did not need to be prepared');
                }

                console.log('Move current view');
                this.externalPanelsHandler.moveCurrentView(subWindow);

                console.log('finished');
            }
        });

        commands.registerCommand(SampleCommand, {
            execute: () => {
                alert('This is a sample command!');
            }
        });
        commands.registerCommand(SampleCommand2, {
            execute: () => {
                alert('This is sample command2!');
            }
        });
        commands.registerCommand(SampleQuickInputCommand, {
            execute: async () => {
                const result = await this.quickInputService.input({
                    placeHolder: 'Please provide a positive integer',
                    validateInput: async (input: string) => {
                        const numericValue = Number(input);
                        if (isNaN(numericValue)) {
                            return 'Invalid: NaN';
                        } else if (numericValue % 2 === 1) {
                            return 'Invalid: Odd Number';
                        } else if (numericValue < 0) {
                            return 'Invalid: Negative Number';
                        } else if (!Number.isInteger(numericValue)) {
                            return 'Invalid: Only Integers Allowed';
                        }
                    }
                });
                if (result) {
                    this.messageService.info(`Positive Integer: ${result}`);
                }
            }
        });
    }

}

@injectable()
export class SampleMenuContribution implements MenuContribution {
    registerMenus(menus: MenuModelRegistry): void {
        const subMenuPath = [...MAIN_MENU_BAR, 'sample-menu'];
        menus.registerSubmenu(subMenuPath, 'Sample Menu', {
            order: '2' // that should put the menu right next to the File menu
        });
        // menus.registerMenuAction(subMenuPath, {
        //     commandId: SampleCommand.id,
        //     order: '0'
        // });
        // menus.registerMenuAction(subMenuPath, {
        //     commandId: SampleCommand2.id,
        //     order: '2'
        // });
        // const subSubMenuPath = [...subMenuPath, 'sample-sub-menu'];
        // menus.registerSubmenu(subSubMenuPath, 'Sample sub menu', { order: '2' });
        // menus.registerMenuAction(subSubMenuPath, {
        //     commandId: SampleCommand.id,
        //     order: '1'
        // });
        // menus.registerMenuAction(subSubMenuPath, {
        //     commandId: SampleCommand2.id,
        //     order: '3'
        // });
        menus.registerMenuAction(subMenuPath, {
            commandId: NewSubWindow.id,
            order: '-1'
        });
        // const placeholder = new PlaceholderMenuNode([...subSubMenuPath, 'placeholder'].join('-'), 'Placeholder', { order: '0' });
        // menus.registerMenuNode(subSubMenuPath, placeholder);

        // /**
        //  * Register an action menu with an invalid command (un-registered and without a label) in order
        //  * to determine that menus and the layout does not break on startup.
        //  */
        // menus.registerMenuAction(subMenuPath, { commandId: 'invalid-command' });
    }

}

/**
 * Special menu node that is not backed by any commands and is always disabled.
 */
export class PlaceholderMenuNode implements MenuNode {

    constructor(readonly id: string, public readonly label: string, protected options?: SubMenuOptions) { }

    get icon(): string | undefined {
        return this.options?.iconClass;
    }

    get sortString(): string {
        return this.options?.order || this.label;
    }

}

export const bindSampleMenu = (bind: interfaces.Bind) => {
    bind(CommandContribution).to(SampleCommandContribution).inSingletonScope();
    bind(MenuContribution).to(SampleMenuContribution).inSingletonScope();
};
