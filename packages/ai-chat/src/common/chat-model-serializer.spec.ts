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

import { expect } from 'chai';
import { Container } from '@theia/core/shared/inversify';
import { ChatAgentLocation } from './chat-agents';
import { MutableChatModel, TextChatResponseContentImpl, MarkdownChatResponseContentImpl } from './chat-model';
import { DefaultChatModelSerializer, DefaultChatRequestModelSerializer, DefaultChatResponseModelSerializer, 
         ChatModelSerializer, ChatRequestModelSerializer, ChatResponseModelSerializer, CHAT_MODEL_SERIALIZER_VERSION } from './chat-model-serializer';
import { TextChatResponseContentSerializer, MarkdownChatResponseContentSerializer, 
         CHAT_RESPONSE_CONTENT_SERIALIZER_CONTRIBUTION_TOKEN } from './chat-response-content-serializer';
import { ContributionProvider } from '@theia/core';
import { MarkdownStringImpl } from '@theia/core/lib/common/markdown-rendering';

describe('ChatModelSerializer', () => {
    let container: Container;
    let chatModelSerializer: ChatModelSerializer;
    let chatRequestSerializer: ChatRequestModelSerializer;
    let chatResponseSerializer: ChatResponseModelSerializer;

    beforeEach(() => {
        container = new Container();
        
        // Set up content serializers
        const contentSerializers = [
            new TextChatResponseContentSerializer(),
            new MarkdownChatResponseContentSerializer()
        ];
        
        const contributionProvider: ContributionProvider<any> = {
            getContributions: () => contentSerializers
        };
        
        container.bind(ContributionProvider).toConstantValue(contributionProvider).whenTargetNamed(CHAT_RESPONSE_CONTENT_SERIALIZER_CONTRIBUTION_TOKEN);
        container.bind(ChatResponseModelSerializer).to(DefaultChatResponseModelSerializer);
        container.bind(ChatRequestModelSerializer).to(DefaultChatRequestModelSerializer);
        container.bind(ChatModelSerializer).to(DefaultChatModelSerializer);
        
        chatResponseSerializer = container.get(ChatResponseModelSerializer);
        chatRequestSerializer = container.get(ChatRequestModelSerializer);
        chatModelSerializer = container.get(ChatModelSerializer);
    });

    describe('DefaultChatModelSerializer', () => {
        it('should serialize an empty chat model', () => {
            const model = new MutableChatModel(ChatAgentLocation.Panel);
            const serialized = chatModelSerializer.serialize(model);

            expect(serialized.version).to.equal(CHAT_MODEL_SERIALIZER_VERSION);
            expect(serialized.sessionId).to.equal(model.id);
            expect(serialized.location).to.equal(ChatAgentLocation.Panel);
            expect(serialized.requests).to.be.an('array').that.is.empty;
            expect(serialized.creationDate).to.be.a('number');
            expect(serialized.lastMessageDate).to.be.a('number');
        });

        it('should serialize a chat model with suggestions', () => {
            const model = new MutableChatModel(ChatAgentLocation.Panel);
            const suggestions = ['suggestion1', new MarkdownStringImpl('**bold**')];
            model.setSuggestions(suggestions);

            const serialized = chatModelSerializer.serialize(model);

            expect(serialized.suggestions).to.have.length(2);
            expect(serialized.suggestions![0]).to.equal('suggestion1');
            expect(serialized.suggestions![1]).to.deep.include({
                value: '**bold**',
                supportMarkdown: false
            });
        });

        it('should serialize a chat model with settings', () => {
            const model = new MutableChatModel(ChatAgentLocation.Panel);
            const settings = { theme: 'dark', autoSave: true };
            model.setSettings(settings);

            const serialized = chatModelSerializer.serialize(model);

            expect(serialized.settings).to.deep.equal(settings);
        });

        it('should deserialize an empty chat model', () => {
            const serializedData = {
                version: CHAT_MODEL_SERIALIZER_VERSION,
                sessionId: 'test-session-id',
                location: ChatAgentLocation.Panel,
                creationDate: Date.now(),
                lastMessageDate: Date.now(),
                requests: [],
                suggestions: ['test suggestion'],
                settings: { theme: 'light' }
            };

            const model = chatModelSerializer.deserialize(serializedData);

            expect(model.id).to.equal('test-session-id');
            expect(model.location).to.equal(ChatAgentLocation.Panel);
            expect(model.isEmpty()).to.be.true;
            expect(model.suggestions).to.have.length(1);
            expect(model.suggestions[0]).to.equal('test suggestion');
            expect(model.settings).to.deep.equal({ theme: 'light' });
        });

        it('should handle version migration gracefully', () => {
            const serializedData = {
                version: 0, // Old version
                sessionId: 'test-session-id',
                location: ChatAgentLocation.Panel,
                creationDate: Date.now(),
                requests: []
            };

            // Should not throw but log a warning
            const model = chatModelSerializer.deserialize(serializedData);
            expect(model.id).to.equal('test-session-id');
        });

        it('should normalize missing required fields', () => {
            const serializedData = {
                version: CHAT_MODEL_SERIALIZER_VERSION,
                // Missing sessionId, creationDate, etc.
                location: ChatAgentLocation.Panel,
                requests: []
            } as any;

            const model = chatModelSerializer.deserialize(serializedData);
            expect(model.id).to.be.a('string');
            expect(model.creationDate).to.be.a('number');
            expect(model.lastMessageDate).to.be.a('number');
        });
    });

    describe('DefaultChatRequestModelSerializer', () => {
        it('should serialize a simple request with context', () => {
            const model = new MutableChatModel(ChatAgentLocation.Panel);
            const parsedRequest = {
                request: {
                    text: 'test message',
                    displayText: 'Test Message',
                    variables: []
                },
                agentName: 'testAgent',
                command: 'testCommand',
                text: 'test message',
                parts: []
            };

            const requestModel = new (MutableChatModel as any).MutableChatRequestModel(
                model, 
                parsedRequest, 
                'test-agent', 
                { variables: [] }, 
                { custom: 'data' }
            );

            const serialized = chatRequestSerializer.serialize(requestModel);

            expect(serialized.requestId).to.equal(requestModel.id);
            expect(serialized.request.text).to.equal('test message');
            expect(serialized.request.displayText).to.equal('Test Message');
            expect(serialized.context.variables).to.be.an('array').that.is.empty;
            expect(serialized.agentId).to.equal('test-agent');
            expect(serialized.data).to.deep.equal({ custom: 'data' });
            expect(serialized.message.agentName).to.equal('testAgent');
            expect(serialized.message.command).to.equal('testCommand');
        });
    });

    describe('DefaultChatResponseModelSerializer', () => {
        it('should serialize a response with text content', () => {
            const responseModel = new (MutableChatModel as any).MutableChatResponseModel('request-id', 'test-agent');
            const textContent = new TextChatResponseContentImpl('Hello world');
            responseModel.response.addContent(textContent);
            responseModel.complete();

            const serialized = chatResponseSerializer.serialize(responseModel);

            expect(serialized?.responseId).to.equal(responseModel.id);
            expect(serialized?.content).to.have.length(1);
            expect(serialized?.content[0].kind).to.equal('text');
            expect(serialized?.content[0].data).to.deep.equal({ content: 'Hello world' });
            expect(serialized?.isComplete).to.be.true;
            expect(serialized?.isCanceled).to.be.false;
            expect(serialized?.agentId).to.equal('test-agent');
        });

        it('should serialize a response with markdown content', () => {
            const responseModel = new (MutableChatModel as any).MutableChatResponseModel('request-id');
            const markdownContent = new MarkdownChatResponseContentImpl('**bold text**');
            responseModel.response.addContent(markdownContent);

            const serialized = chatResponseSerializer.serialize(responseModel);

            expect(serialized?.content).to.have.length(1);
            expect(serialized?.content[0].kind).to.equal('markdownContent');
            expect(serialized?.content[0].data).to.deep.include({
                value: '**bold text**'
            });
        });

        it('should deserialize a response with content', () => {
            const serializedResponse = {
                responseId: 'response-id',
                content: [
                    {
                        kind: 'text',
                        data: { content: 'Hello world' }
                    }
                ],
                isComplete: true,
                isCanceled: false,
                isWaitingForInput: false,
                isError: false,
                agentId: 'test-agent',
                data: {}
            };

            const responseModel = chatResponseSerializer.deserialize(serializedResponse, 'request-id');

            expect(responseModel.id).to.equal('response-id');
            expect(responseModel.response.content).to.have.length(1);
            expect(responseModel.response.content[0].kind).to.equal('text');
            expect((responseModel.response.content[0] as any).content).to.equal('Hello world');
            expect(responseModel.isComplete).to.be.true;
            expect(responseModel.agentId).to.equal('test-agent');
        });

        it('should handle missing serializer gracefully', () => {
            const responseModel = new (MutableChatModel as any).MutableChatResponseModel('request-id');
            // Add content with unknown kind
            const unknownContent = {
                kind: 'unknown',
                asString: () => 'fallback text'
            };
            responseModel.response.addContent(unknownContent);

            const serialized = chatResponseSerializer.serialize(responseModel);

            expect(serialized?.content).to.have.length(1);
            expect(serialized?.content[0].kind).to.equal('unknown');
            expect(serialized?.content[0].data).to.deep.equal({ fallback: 'fallback text' });
        });

        it('should handle deserialization of unknown content types', () => {
            const serializedResponse = {
                responseId: 'response-id',
                content: [
                    {
                        kind: 'unknown',
                        data: { fallback: 'fallback text' }
                    }
                ],
                isComplete: false,
                isCanceled: false,
                isWaitingForInput: false,
                isError: false,
                data: {}
            };

            const responseModel = chatResponseSerializer.deserialize(serializedResponse, 'request-id');

            expect(responseModel.response.content).to.have.length(1);
            expect(responseModel.response.content[0].kind).to.equal('text');
            expect((responseModel.response.content[0] as any).content).to.equal('fallback text');
        });

        it('should handle error states', () => {
            const responseModel = new (MutableChatModel as any).MutableChatResponseModel('request-id');
            responseModel.error(new Error('Test error'));

            const serialized = chatResponseSerializer.serialize(responseModel);

            expect(serialized?.isError).to.be.true;
            expect(serialized?.errorMessage).to.equal('Test error');
        });

        it('should deserialize error states', () => {
            const serializedResponse = {
                responseId: 'response-id',
                content: [],
                isComplete: true,
                isCanceled: false,
                isWaitingForInput: false,
                isError: true,
                errorMessage: 'Test error',
                data: {}
            };

            const responseModel = chatResponseSerializer.deserialize(serializedResponse, 'request-id');

            expect(responseModel.isError).to.be.true;
            expect(responseModel.errorObject?.message).to.equal('Test error');
        });

        it('should throw error when deserializing undefined response data', () => {
            expect(() => {
                chatResponseSerializer.deserialize(undefined as any, 'request-id');
            }).to.throw('Cannot deserialize undefined response data');
        });
    });

    describe('Integration tests', () => {
        it('should round-trip serialize and deserialize a complete chat model', () => {
            // Create a model with content
            const originalModel = new MutableChatModel(ChatAgentLocation.Panel);
            originalModel.setSettings({ theme: 'dark' });
            originalModel.setSuggestions(['test suggestion']);

            // Serialize the model
            const serialized = chatModelSerializer.serialize(originalModel);

            // Deserialize it back
            const deserializedModel = chatModelSerializer.deserialize(serialized);

            // Verify the data is preserved
            expect(deserializedModel.id).to.equal(originalModel.id);
            expect(deserializedModel.location).to.equal(originalModel.location);
            expect(deserializedModel.settings).to.deep.equal(originalModel.settings);
            expect(deserializedModel.suggestions).to.deep.equal(['test suggestion']);
            expect(deserializedModel.isEmpty()).to.equal(originalModel.isEmpty());
        });
    });
});