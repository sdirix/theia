/********************************************************************************
 * Copyright (C) 2021 Ericsson and others.
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
import { inject, injectable, postConstruct } from 'inversify';
import { WidgetManager } from '../widget-manager';
import { BoxLayout, BoxPanel, Widget } from '@phosphor/widgets';
import { ApplicationShell } from './application-shell';
import { TheiaDockPanel } from './theia-dock-panel';

interface ManagedWindow {
    window: Window;
    panel: TheiaDockPanel;
}

/**
 * A class to manage one or more panels which are not part of the main window.
 */
@injectable()
export class ExternalPanelsHandler {

    @postConstruct()
    protected init(): void {
        window.addEventListener('message', (event: MessageEvent) => {
            console.log('Message on main window', event);
            if (event.data.fromExternal) {
                console.log('Message comes from external window');
                return;
            }
            if (event.data.fromMain) {
                console.log('Message has mainWindow marker, therefore ignore it');
                return;
            }
            console.log('Delegate main window message to external windows', event);
            this.managedWindows.forEach(managedWindow => {
                if (!managedWindow.window.closed) {
                    console.log('Delegate main window message to external window');
                    managedWindow.window.postMessage({ ...event.data, fromMain: true }, '*');
                }
            });
        });
    }

    @inject(ApplicationShell)
    protected shell: ApplicationShell;

    @inject(WidgetManager)
    protected widgetManager: WidgetManager;

    protected managedWindows: ManagedWindow[] = [];

    public prepareWindow(extWindow: Window): boolean {
        if (this.managedWindows.map(mw => mw.window).includes(extWindow)) {
            console.debug('window is already managed');
            return false;
        }
        // styles.css is the extracted CSS from the webpack build
        extWindow.document.write(`<!doctype html>
                <html>
                    <head>
                        <title>Sub Window</title>
                        <link rel="stylesheet" href="styles.css"/>
                    </head>
                    <body>
                        <div id="pwidget"></div>
                    </body>
                </html>
                `);
        extWindow.document.close();
        return true;
    }

    public createPanelInExternalWindow(window: Window): void {
        if (this.managedWindows.map(mw => mw.window).includes(window)) {
            console.debug("Can't create panel in external window as window is already managed");
            return;
        }
        const panel = this.shell.createExternalPanel();
        this.managedWindows.push({ window, panel });

        const element = window.document.getElementById('pwidget');
        if (!element) {
            console.error('Could not find dom element to attach to in sub window');
            return;
        }
        panel.addClass('theia-app-main');
        const rootWidget = new ExternalRootWidget();
        Widget.attach(rootWidget, element);
        rootWidget.addWidget(panel);
    }

    public addWidget(window: Window, widget: Widget): void {
        const panel = this.managedWindows.find(element => element.window === window)?.panel;
        if (!panel) {
            console.error('Could not find panel for the given window. Was the panel created before?');
            return;
        }
        panel.addWidget(widget);
        panel.selectWidget(widget);
    }

    public moveCurrentView(window: Window): void {
        let widget = this.shell.getCurrentWidget('main');
        if (!widget) {
            console.error('There is no active widget in the main area');
            widget = this.shell.getCurrentWidget('bottom');
            if (!widget) {
                console.error('There is no active widget in the bottom area');
                return;
            }
        }
        this.addWidget(window, widget);
        widget.update();
    }

    public moveWelcomeWidget(window: Window): void {
        const widget = this.widgetManager.tryGetWidget('getting.started.widget');
        if (!widget) {
            console.error('Could not find welcome widget');
            return;
        }
        this.addWidget(window, widget);
        this.shell.activateWidget(widget.id);
        widget.update();
    }
}

class ExternalRootWidget extends Widget {

    constructor() {
        super();

        this.layout = new BoxLayout();
        // APPLICATION CSS CLASS
        this.addClass('theia-ApplicationShell');
        this.id = 'theia-app-shell';
    }

    addWidget(widget: Widget): void {
        (this.layout as BoxLayout).addWidget(widget);
        BoxPanel.setStretch(widget, 1);
    }

}
