// *****************************************************************************
// Copyright (C) 2024 EclipseSource GmbH.
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

import { ContainerModule } from '@theia/core/shared/inversify';
import {
    ChatModelSerializer,
    ChatRequestModelSerializer,
    ChatResponseModelSerializer,
    DefaultChatModelSerializer,
    DefaultChatRequestModelSerializer,
    DefaultChatResponseModelSerializer
} from './chat-model-serializer';
import {
    CHAT_RESPONSE_CONTENT_SERIALIZER_CONTRIBUTION_TOKEN,
    TextChatResponseContentSerializer,
    MarkdownChatResponseContentSerializer,
    CodeChatResponseContentSerializer,
    ErrorChatResponseContentSerializer,
    InformationalChatResponseContentSerializer,
    CommandChatResponseContentSerializer,
    HorizontalLayoutChatResponseContentSerializer,
    ToolCallChatResponseContentSerializer,
    ThinkingChatResponseContentSerializer,
    ProgressChatResponseContentSerializer
} from './chat-response-content-serializer';

export default new ContainerModule(bind => {
    // Bind serialization services
    bind(ChatModelSerializer).to(DefaultChatModelSerializer).inSingletonScope();
    bind(ChatRequestModelSerializer).to(DefaultChatRequestModelSerializer).inSingletonScope();
    bind(ChatResponseModelSerializer).to(DefaultChatResponseModelSerializer).inSingletonScope();

    // Bind built-in response content serializers as contributions
    bind(CHAT_RESPONSE_CONTENT_SERIALIZER_CONTRIBUTION_TOKEN).to(TextChatResponseContentSerializer).inSingletonScope();
    bind(CHAT_RESPONSE_CONTENT_SERIALIZER_CONTRIBUTION_TOKEN).to(MarkdownChatResponseContentSerializer).inSingletonScope();
    bind(CHAT_RESPONSE_CONTENT_SERIALIZER_CONTRIBUTION_TOKEN).to(CodeChatResponseContentSerializer).inSingletonScope();
    bind(CHAT_RESPONSE_CONTENT_SERIALIZER_CONTRIBUTION_TOKEN).to(ErrorChatResponseContentSerializer).inSingletonScope();
    bind(CHAT_RESPONSE_CONTENT_SERIALIZER_CONTRIBUTION_TOKEN).to(InformationalChatResponseContentSerializer).inSingletonScope();
    bind(CHAT_RESPONSE_CONTENT_SERIALIZER_CONTRIBUTION_TOKEN).to(CommandChatResponseContentSerializer).inSingletonScope();
    bind(CHAT_RESPONSE_CONTENT_SERIALIZER_CONTRIBUTION_TOKEN).to(HorizontalLayoutChatResponseContentSerializer).inSingletonScope();
    bind(CHAT_RESPONSE_CONTENT_SERIALIZER_CONTRIBUTION_TOKEN).to(ToolCallChatResponseContentSerializer).inSingletonScope();
    bind(CHAT_RESPONSE_CONTENT_SERIALIZER_CONTRIBUTION_TOKEN).to(ThinkingChatResponseContentSerializer).inSingletonScope();
    bind(CHAT_RESPONSE_CONTENT_SERIALIZER_CONTRIBUTION_TOKEN).to(ProgressChatResponseContentSerializer).inSingletonScope();
});
