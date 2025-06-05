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

import { inject, injectable, named } from '@theia/core/shared/inversify';
import { ContributionProvider } from '@theia/core';
import { ChatAgentLocation } from './chat-agents';
import { ChatResponseContent, MutableChatModel, MutableChatRequestModel, MutableChatResponseModel } from './chat-model';
import { ParsedChatRequest, ParsedChatRequestPart } from './parsed-chat-request';
import { ChatResponseContentSerializer, CHAT_RESPONSE_CONTENT_SERIALIZER_CONTRIBUTION_TOKEN } from './chat-response-content-serializer';
import { AIVariableResolutionRequest, ResolvedAIContextVariable } from '@theia/ai-core';
import { MarkdownString } from '@theia/core/lib/common/markdown-rendering';

export const CHAT_MODEL_SERIALIZER_VERSION = 1;

/**********************
 * SERIALIZABLE DATA INTERFACES
 **********************/

export interface SerializableChatContextVariable {
    readonly variable: {
        readonly id: string;
        readonly name: string;
        readonly description?: string;
    };
    readonly arg?: string;
    readonly value?: string;
    readonly languageModelMessages?: unknown[];
    readonly references?: {
        readonly anchor: {
            readonly uri: string;
            readonly position?: {
                readonly line: number;
                readonly character: number;
            };
        };
        readonly range?: {
            readonly start: {
                readonly line: number;
                readonly character: number;
            };
            readonly end: {
                readonly line: number;
                readonly character: number;
            };
        };
    }[];
}

export interface SerializableChatRequest {
    readonly text: string;
    readonly displayText?: string;
    readonly referencedRequestId?: string;
    readonly variables?: readonly SerializableChatContextVariable[];
}

export interface SerializableChatContext {
    readonly variables: SerializableChatContextVariable[];
}

export interface SerializableChatResponseContent {
    readonly kind: string;
    readonly data: unknown;
}

export interface SerializableChatRequestData {
    readonly requestId: string;
    readonly request: SerializableChatRequest;
    readonly context: SerializableChatContext;
    readonly agentId?: string;
    readonly data?: { [key: string]: unknown };
    readonly message: {
        readonly request: SerializableChatRequest;
        readonly agentName?: string;
        readonly command?: string;
        readonly text: string;
        readonly parts?: unknown[];
    };
    readonly response?: {
        readonly responseId: string;
        readonly content: SerializableChatResponseContent[];
        readonly isComplete: boolean;
        readonly isCanceled: boolean;
        readonly isWaitingForInput: boolean;
        readonly isError: boolean;
        readonly agentId?: string;
        readonly errorMessage?: string;
        readonly data?: { [key: string]: unknown };
    };
}

export interface SerializableChatData {
    readonly version: number;
    readonly sessionId: string;
    readonly location: ChatAgentLocation;
    readonly creationDate: number;
    readonly lastMessageDate?: number;
    readonly customTitle?: string;
    readonly requests: SerializableChatRequestData[];
    readonly suggestions?: readonly (string | { value: string; supportMarkdown: boolean; isTrusted?: boolean })[];
    readonly settings?: { [key: string]: unknown };
}

/**********************
 * SERIALIZER INTERFACES
 **********************/

export const ChatModelSerializer = Symbol('ChatModelSerializer');
export interface ChatModelSerializer {
    serialize(chatModel: MutableChatModel): SerializableChatData;
    deserialize(data: SerializableChatData): MutableChatModel;
}

export const ChatRequestModelSerializer = Symbol('ChatRequestModelSerializer');
export interface ChatRequestModelSerializer {
    serialize(requestModel: MutableChatRequestModel): SerializableChatRequestData;
    deserialize(data: SerializableChatRequestData, session: MutableChatModel): MutableChatRequestModel;
}

export const ChatResponseModelSerializer = Symbol('ChatResponseModelSerializer');
export interface ChatResponseModelSerializer {
    serialize(responseModel: MutableChatResponseModel): SerializableChatRequestData['response'];
    deserialize(data: SerializableChatRequestData['response'], requestId: string): MutableChatResponseModel;
}

/**********************
 * DEFAULT IMPLEMENTATIONS
 **********************/

@injectable()
export class DefaultChatModelSerializer implements ChatModelSerializer {

    @inject(ChatRequestModelSerializer)
    protected readonly requestSerializer: ChatRequestModelSerializer;

    serialize(chatModel: MutableChatModel): SerializableChatData {
        const requests = chatModel.getRequests().map(request => this.requestSerializer.serialize(request));

        const suggestions = chatModel.suggestions.map(suggestion => {
            if (typeof suggestion === 'string') {
                return suggestion;
            } else if (MarkdownString.is(suggestion)) {
                return {
                    value: suggestion.value,
                    supportMarkdown: suggestion.isTrusted !== undefined,
                    isTrusted: suggestion.isTrusted
                };
            } else {
                // For ChatSuggestionCallback, we can't serialize the callback function
                // So we just store the content part
                return typeof suggestion.content === 'string'
                    ? suggestion.content
                    : {
                        value: suggestion.content.value,
                        supportMarkdown: suggestion.content.isTrusted !== undefined,
                        isTrusted: suggestion.content.isTrusted
                    };
            }
        });

        return {
            version: CHAT_MODEL_SERIALIZER_VERSION,
            sessionId: chatModel.id,
            location: chatModel.location,
            creationDate: Date.now(), // TODO: Add creationDate tracking to MutableChatModel
            lastMessageDate: Date.now(), // TODO: Add lastMessageDate tracking to MutableChatModel
            customTitle: undefined, // TODO: Add title support to MutableChatModel
            requests,
            suggestions: suggestions as readonly (string | { value: string; supportMarkdown: boolean; isTrusted?: boolean })[],
            settings: chatModel.settings
        };
    }

    deserialize(data: SerializableChatData): MutableChatModel {
        // Validate version and handle migration if needed
        const normalizedData = this.normalizeSerializableData(data);

        // Create the model with the serialized data
        const model = new MutableChatModel(normalizedData.location, normalizedData);

        // Deserialize requests
        if (normalizedData.requests && normalizedData.requests.length > 0) {
            for (const requestData of normalizedData.requests) {
                this.requestSerializer.deserialize(requestData, model);
            }
        }

        // Set suggestions if available
        if (normalizedData.suggestions) {
            const deserializedSuggestions = normalizedData.suggestions.map(suggestion => {
                if (typeof suggestion === 'string') {
                    return suggestion;
                } else {
                    return {
                        value: suggestion.value,
                        supportMarkdown: suggestion.supportMarkdown,
                        isTrusted: suggestion.isTrusted
                    };
                }
            });
            model.setSuggestions(deserializedSuggestions);
        }

        // Set settings if available
        if (normalizedData.settings) {
            model.setSettings(normalizedData.settings);
        }

        return model;
    }

    protected normalizeSerializableData(data: SerializableChatData): SerializableChatData {
        // Handle version migration
        if (data.version !== CHAT_MODEL_SERIALIZER_VERSION) {
            console.warn(`Unsupported chat model serialization version: ${data.version}. Current version: ${CHAT_MODEL_SERIALIZER_VERSION}`);
            // For now, we'll attempt to load it anyway, but in the future we can implement migration logic here
        }

        // Ensure required fields are present
        const normalized: SerializableChatData = {
            version: CHAT_MODEL_SERIALIZER_VERSION,
            sessionId: data.sessionId || `restored-${Date.now()}`,
            location: data.location || ChatAgentLocation.Panel,
            creationDate: data.creationDate || Date.now(),
            lastMessageDate: data.lastMessageDate || data.creationDate || Date.now(),
            customTitle: data.customTitle,
            requests: data.requests || [],
            suggestions: data.suggestions,
            settings: data.settings
        };

        return normalized;
    }
}

@injectable()
export class DefaultChatRequestModelSerializer implements ChatRequestModelSerializer {

    @inject(ChatResponseModelSerializer)
    protected readonly responseSerializer: ChatResponseModelSerializer;

    serialize(requestModel: MutableChatRequestModel): SerializableChatRequestData {
        const context = this.serializeContext(requestModel.context);
        const request = this.serializeRequest(requestModel.request);
        const message = this.serializeParsedChatRequest(requestModel.message);

        const responseData = requestModel.response ? this.responseSerializer.serialize(requestModel.response) : undefined;

        return {
            requestId: requestModel.id,
            request,
            context,
            agentId: requestModel.agentId,
            data: requestModel.data,
            message,
            response: responseData
        };
    }

    deserialize(data: SerializableChatRequestData, session: MutableChatModel): MutableChatRequestModel {
        const parsedRequest = this.deserializeParsedChatRequest(data.message);
        const context = this.deserializeContext(data.context);

        const requestModel = new MutableChatRequestModel(
            session,
            parsedRequest,
            data.agentId,
            context,
            data.data || {}
        );

        // Override the generated ID with the serialized one
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (requestModel as any)._id = data.requestId;

        // Deserialize response if available
        if (data.response) {
            const responseModel = this.responseSerializer.deserialize(data.response, data.requestId);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (requestModel as any)._response = responseModel;
        }

        return requestModel;
    }

    protected serializeContext(context: { variables: ResolvedAIContextVariable[] }): SerializableChatContext {
        return {
            variables: context.variables.map(variable => this.serializeContextVariable(variable))
        };
    }

    protected deserializeContext(data: SerializableChatContext): { variables: ResolvedAIContextVariable[] } {
        return {
            variables: data.variables.map(variable => this.deserializeContextVariable(variable))
        };
    }

    protected serializeRequest(request: { text: string; displayText?: string; referencedRequestId?: string; variables?: readonly AIVariableResolutionRequest[] }):
        SerializableChatRequest {
        return {
            text: request.text,
            displayText: request.displayText,
            referencedRequestId: request.referencedRequestId,
            variables: request.variables?.map(variable => this.serializeAIVariableResolutionRequest(variable))
        };
    }

    protected serializeParsedChatRequest(message: ParsedChatRequest): SerializableChatRequestData['message'] {
        return {
            request: this.serializeRequest(message.request),
            // These properties don't exist on ParsedChatRequest, but are required by the message interface
            // We'll use empty values for now
            agentName: '',
            command: '',
            text: message.request.text,
            parts: message.parts // TODO: Proper serialization of parts if needed
        };
    }

    protected deserializeParsedChatRequest(data: SerializableChatRequestData['message']): ParsedChatRequest {
        const request = {
            text: data.request.text,
            displayText: data.request.displayText,
            referencedRequestId: data.request.referencedRequestId,
            variables: data.request.variables?.map(variable => this.deserializeAIVariableResolutionRequest(variable))
        };

        return {
            request,
            parts: (data.parts || []) as ParsedChatRequestPart[],
            toolRequests: new Map(),
            variables: []
        };
    }

    protected serializeContextVariable(variable: ResolvedAIContextVariable): SerializableChatContextVariable {
        return {
            variable: {
                id: variable.variable.id,
                name: variable.variable.name,
                description: variable.variable.description
            },
            arg: variable.arg,
            value: variable.value,
            // These properties don't exist on ResolvedAIContextVariable
            languageModelMessages: [],
            references: []
        };
    }

    protected deserializeContextVariable(data: SerializableChatContextVariable): ResolvedAIContextVariable {
        return {
            variable: {
                id: data.variable.id,
                name: data.variable.name,
                description: data.variable.description || ''
            },
            arg: data.arg,
            value: data.value || '',
            contextValue: ''
        };
    }

    protected serializeAIVariableResolutionRequest(variable: AIVariableResolutionRequest): SerializableChatContextVariable {
        // Convert AIVariableResolutionRequest to the same format as ResolvedAIContextVariable for serialization
        return {
            variable: {
                id: variable.variable.id,
                name: variable.variable.name,
                description: variable.variable.description
            },
            arg: variable.arg
        };
    }

    protected deserializeAIVariableResolutionRequest(data: SerializableChatContextVariable): AIVariableResolutionRequest {
        return {
            variable: {
                id: data.variable.id,
                name: data.variable.name,
                description: data.variable.description || ''
            },
            arg: data.arg
        };
    }
}

@injectable()
export class DefaultChatResponseModelSerializer implements ChatResponseModelSerializer {

    @inject(ContributionProvider)
    @named(CHAT_RESPONSE_CONTENT_SERIALIZER_CONTRIBUTION_TOKEN)
    protected readonly contentSerializers: ContributionProvider<ChatResponseContentSerializer>;

    serialize(responseModel: MutableChatResponseModel): SerializableChatRequestData['response'] {
        const serializedContent: SerializableChatResponseContent[] = [];

        for (const content of responseModel.response.content) {
            const serializer = this.getSerializerForContent(content);
            if (serializer) {
                try {
                    const serializedData = serializer.serialize(content);
                    serializedContent.push({
                        kind: content.kind,
                        data: serializedData
                    });
                } catch (error) {
                    console.warn(`Failed to serialize content of kind '${content.kind}':`, error);
                    // Skip this content item if serialization fails
                }
            } else {
                console.warn(`No serializer found for content kind: ${content.kind}`);
                // Store a minimal representation
                serializedContent.push({
                    kind: content.kind,
                    data: { fallback: content.asString?.() || `[${content.kind}]` }
                });
            }
        }

        return {
            responseId: responseModel.id,
            content: serializedContent,
            isComplete: responseModel.isComplete,
            isCanceled: responseModel.isCanceled,
            isWaitingForInput: responseModel.isWaitingForInput,
            isError: responseModel.isError,
            agentId: responseModel.agentId,
            errorMessage: responseModel.errorObject?.message,
            data: responseModel.data
        };
    }

    deserialize(data: SerializableChatRequestData['response'], requestId: string): MutableChatResponseModel {
        if (!data) {
            throw new Error('Cannot deserialize undefined response data');
        }

        const responseModel = new MutableChatResponseModel(requestId, data.agentId);

        // Override the generated ID with the serialized one
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (responseModel as any)._id = data.responseId;

        // Deserialize content
        const deserializedContent: ChatResponseContent[] = [];
        for (const contentData of data.content) {
            const serializer = this.getSerializerForKind(contentData.kind);
            if (serializer) {
                try {
                    const content = serializer.deserialize(contentData.data);
                    deserializedContent.push(content);
                } catch (error) {
                    console.warn(`Failed to deserialize content of kind '${contentData.kind}':`, error);
                    // Skip this content item if deserialization fails
                }
            } else {
                console.warn(`No serializer found for content kind: ${contentData.kind}`);
                // Create a fallback text content
                if (contentData.data && typeof contentData.data === 'object' && 'fallback' in contentData.data) {
                    const dataObj = contentData.data as Record<string, unknown>;
                    const fallbackText = String(dataObj.fallback || '');
                    const fallbackContent = {
                        kind: 'text' as const,
                        content: fallbackText,
                        asString: () => fallbackText,
                        asDisplayString: () => fallbackText,
                        merge: () => false,
                        toLanguageModelMessage: () => ({
                            actor: 'ai' as const,
                            type: 'text' as const,
                            text: fallbackText
                        })
                    };
                    deserializedContent.push(fallbackContent);
                }
            }
        }

        // Set the content
        responseModel.response.addContents(deserializedContent);

        // Set state
        if (data.isComplete) {
            responseModel.complete();
        }
        if (data.isCanceled) {
            responseModel.cancel();
        }
        if (data.isWaitingForInput) {
            responseModel.waitForInput();
        }
        if (data.isError && data.errorMessage) {
            responseModel.error(new Error(data.errorMessage));
        }

        // Set data
        if (data.data) {
            Object.assign(responseModel.data, data.data);
        }

        return responseModel;
    }

    protected getSerializerForContent(content: ChatResponseContent): ChatResponseContentSerializer | undefined {
        return this.contentSerializers.getContributions().find(serializer => serializer.canHandle(content));
    }

    protected getSerializerForKind(kind: string): ChatResponseContentSerializer | undefined {
        return this.contentSerializers.getContributions().find(serializer => serializer.canHandleKind(kind));
    }
}
