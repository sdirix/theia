/********************************************************************************
 * Copyright (C) 2017 TypeFox and others.
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

import { inject, injectable, named } from 'inversify';
import URI from '@theia/core/lib/common/uri';
import { ContributionProvider, MaybePromise, Prioritizeable } from '@theia/core';

export const PreviewHandler = Symbol('PreviewHandler');

/**
 * The parameters given to the preview handler to render the preview content.
 */
export interface RenderContentParams {
    /**
     * Textual content of the resource.
     */
    content: string;
    /**
     * URI identifying the source resource.
     */
    originUri: URI;
}

export namespace RenderContentParams {
    export function is(params: object | undefined): params is RenderContentParams {
        return !!params && 'content' in params && 'originUri' in params;
    }
}

/**
 * A PreviewHandler manages the communication between text editor and preview widget including whether a preview shall be shown at all.
 * 
 * See {@link MarkdownPreviewHandler} for an example implementation.
 */
export interface PreviewHandler {
    /**
     * One or more classes which shall be applied to the preview widget icon.
     */
    readonly iconClass?: string;
    /**
     * Indicates whether and with which priority (larger is better) this preview handler is responsible for the given resource identified by the given URI.
     * 
     * @param uri the URI identifying a resource.
     * 
     * @returns A number larger than 0 if the handler is applicable, 0 or a negative number otherwise.
     */
    canHandle(uri: URI): number;
    /**
     * Render the preview content by returning appropriate HTML.
     * 
     * @param params Information for the handler to render its content. Contains at least the textual content and the document URI.
     * 
     * @returns the HTMLElement which will be attached to the preview widget.
     */
    renderContent(params: RenderContentParams): MaybePromise<HTMLElement | undefined>;
    /**
     * Search and return the HTMLElement which corresponds to the given fragment.
     * This is used to initially reveal elements identified via the URI fragment.
     * 
     * @param content the preview widget element containing the content previously rendered by {@link PreviewHandler.renderContent}. 
     * @param fragment the URI fragment for which the corresponding element shall be returned
     * 
     * @returns the HTMLElement which is part of content and corresponds to the given fragment, undefined otherwise.
     */
    findElementForFragment?(content: HTMLElement, fragment: string): HTMLElement | undefined;
    /**
     * Search and return the HTMLElement which corresponds to the given line number.
     * This is used to scroll the preview when the source editor scrolls.
     * 
     * @param content the preview widget element containing the previously rendered by {@link PreviewHandler.renderContent}. 
     * @param sourceLine the line number for which the corresponding element shall be returned.
     * 
     * @returns the HTMLElement which is part of content and corresponds to the given line number, undefined otherwise.
     */
    findElementForSourceLine?(content: HTMLElement, sourceLine: number): HTMLElement | undefined;
    /**
     * Returns the line number which corresponds to the preview element at the given offset.
     * This is used to scroll the source editor when the preview scrolls.
     * 
     * @param content the preview widget element containing the previously rendered by {@link PreviewHandler.renderContent}. 
     * @param offset the total amount by which the preview widget is scrolled.
     * 
     * @returns the source line number which corresponds to the preview element at the given offset, undefined otherwise.
     */
    getSourceLineForOffset?(content: HTMLElement, offset: number): number | undefined;
}

/**
 * Provider managing the available PreviewHandlers. 
 */
@injectable()
export class PreviewHandlerProvider {

    constructor(
        @inject(ContributionProvider) @named(PreviewHandler)
        protected readonly previewHandlerContributions: ContributionProvider<PreviewHandler>
    ) { }

    /**
     * Find PreviewHandlers for the given resource identifier.
     * 
     * @param uri the URI identifying a resource.
     * 
     * @returns a list of all PreviewHandlers which can handle the resource identified by the given URI sorted for priority.
     */
    findContribution(uri: URI): PreviewHandler[] {
        const prioritized = Prioritizeable.prioritizeAllSync(this.previewHandlerContributions.getContributions(), contrib =>
            contrib.canHandle(uri)
        );
        return prioritized.map(c => c.value);
    }

    /**
     * Indicates whether any PreviewHandler can process the resource identified by the given URI.
     * 
     * @param uri the URI identifying a resource.
     * 
     * @returns `true` when a PreviewHandler can process the resource, `false` otherwise.
     */
    canHandle(uri: URI): boolean {
        return this.findContribution(uri).length > 0;
    }

}
