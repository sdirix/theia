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
import { ChatService, ChatAgentLocation } from '@theia/ai-chat/lib/common';
import { AIChatContribution } from './ai-chat-ui-contribution';

/**
 * Handles `--chat "prompt"` arguments from external requests by opening
 * the AI chat view, creating a new session, and sending the prompt.
 */
@injectable()
export class CliChatContribution implements ExternalRequestContribution {

    @inject(ChatService)
    protected readonly chatService: ChatService;

    @inject(AIChatContribution)
    protected readonly chatViewContribution: AIChatContribution;

    async onExternalRequest(request: ExternalRequest): Promise<void> {
        if (!CliExternalRequest.is(request)) {
            return;
        }
        const prompt = request.parameters.chat;
        if (typeof prompt !== 'string') {
            return;
        }

        await this.chatViewContribution.openView({ activate: true });
        const session = this.chatService.createSession(ChatAgentLocation.Panel, { focus: true });
        await this.chatService.sendRequest(session.id, { text: prompt });
    }
}
