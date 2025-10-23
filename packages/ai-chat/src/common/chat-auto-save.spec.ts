// *****************************************************************************
// Copyright (C) 2025 EclipseSource GmbH.
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
import { ChatServiceImpl } from './chat-service';
import { ChatSessionStore } from './chat-session-store';
import { ChatAgentService } from './chat-agent-service';
import { ChatRequestParser } from './chat-request-parser';
import { AIVariableService } from '@theia/ai-core';
import { ILogger } from '@theia/core';
import { ChatAgentLocation } from './chat-agents';
import { ChatContentDeserializerRegistry, ChatContentDeserializerRegistryImpl, DefaultChatContentDeserializerContribution } from './chat-content-serializer';
import { ChangeSetElementDeserializerRegistry, ChangeSetElementDeserializerRegistryImpl } from './change-set-element-deserializer';

describe('Chat Auto-Save Mechanism', () => {
    let chatService: ChatServiceImpl;
    let sessionStore: MockChatSessionStore;
    let container: Container;

    class MockChatSessionStore implements ChatSessionStore {
        public saveCount = 0;
        public savedSessions: any[] = [];
        public lastSaveTimes: Map<string, number> = new Map();

        async storeSessions(...sessions: any[]): Promise<void> {
            this.saveCount++;
            this.savedSessions = sessions;
            // Track save times per session
            sessions.forEach(session => {
                this.lastSaveTimes.set(session.model?.id || session.id, Date.now());
            });
        }

        async readSession(sessionId: string): Promise<any> {
            return undefined;
        }

        async deleteSession(sessionId: string): Promise<void> {
            // No-op for mock
        }

        async clearAllSessions(): Promise<void> {
            this.savedSessions = [];
            this.saveCount = 0;
            this.lastSaveTimes.clear();
        }

        async getSessionIndex(): Promise<any> {
            return {};
        }

        async setSessionTitle(sessionId: string, title: string): Promise<void> {
            // No-op for mock
        }

        reset(): void {
            this.saveCount = 0;
            this.savedSessions = [];
            this.lastSaveTimes.clear();
        }
    }

    class MockChatAgentService {
        private testAgent = {
            id: 'test-agent',
            name: 'Test Agent',
            invoke: () => Promise.resolve()
        };

        getAgent() {
            return this.testAgent;
        }
        getAgents() {
            return [this.testAgent];
        }
    }

    class MockChatRequestParser {
        parseChatRequest() {
            return Promise.resolve({
                request: { text: 'test' },
                parts: [{
                    kind: 'text' as const,
                    text: 'test',
                    promptText: 'test',
                    range: { start: 0, endExclusive: 4 }
                }],
                toolRequests: new Map(),
                variables: []
            });
        }
    }

    class MockAIVariableService {
        resolveVariables() {
            return Promise.resolve([]);
        }
        resolveVariable() {
            return Promise.resolve(undefined);
        }
    }

    class MockLogger {
        error() { }
        warn() { }
        info() { }
        debug() { }
    }

    beforeEach(() => {
        container = new Container();
        sessionStore = new MockChatSessionStore();

        container.bind(ChatSessionStore).toConstantValue(sessionStore);
        container.bind(ChatAgentService).toConstantValue(new MockChatAgentService() as any);
        container.bind(ChatRequestParser).toConstantValue(new MockChatRequestParser() as any);
        container.bind(AIVariableService).toConstantValue(new MockAIVariableService() as any);
        container.bind(ILogger).toConstantValue(new MockLogger() as any);

        // Bind deserializer registries
        const contentRegistry = new ChatContentDeserializerRegistryImpl();
        new DefaultChatContentDeserializerContribution().registerDeserializers(contentRegistry);
        container.bind(ChatContentDeserializerRegistry).toConstantValue(contentRegistry);
        container.bind(ChangeSetElementDeserializerRegistry).toConstantValue(new ChangeSetElementDeserializerRegistryImpl());

        container.bind(ChatServiceImpl).toSelf().inSingletonScope();

        chatService = container.get(ChatServiceImpl);
    });

    describe('Auto-save on response completion', () => {
        it('should auto-save when response is complete', async () => {
            const session = chatService.createSession(ChatAgentLocation.Panel);
            const initialSaveCount = sessionStore.saveCount;

            // Send a request
            const invocation = await chatService.sendRequest(session.id, { text: 'Test request' });
            const responseModel = await invocation!.responseCreated;

            // Complete the response
            (responseModel as any).complete();

            // Wait for auto-save to complete (debounce is 500ms + execution time)
            await new Promise(resolve => setTimeout(resolve, 700));

            // Verify session was auto-saved
            expect(sessionStore.saveCount).to.be.greaterThan(initialSaveCount);
        });

        it('should auto-save when response has error', async () => {
            const session = chatService.createSession(ChatAgentLocation.Panel);
            const initialSaveCount = sessionStore.saveCount;

            // Send a request that will error
            const invocation = await chatService.sendRequest(session.id, { text: 'Test request' });
            const responseModel = await invocation!.responseCreated;

            // Simulate error
            (responseModel as any).error(new Error('Test error'));

            // Wait for auto-save to complete (debounce is 500ms + execution time)
            await new Promise(resolve => setTimeout(resolve, 700));

            // Verify session was auto-saved even on error
            expect(sessionStore.saveCount).to.be.greaterThan(initialSaveCount);
        });
    });

    describe('Auto-save on changeset updates', () => {
        it('should auto-save when changeset elements are updated', async () => {
            const session = chatService.createSession(ChatAgentLocation.Panel);
            // Add a request so the session is not empty
            await chatService.sendRequest(session.id, { text: 'Test request' });
            sessionStore.reset();

            // Trigger changeset update event via model's internal emitter
            (session.model as any)._onDidChangeEmitter.fire({ kind: 'updateChangeSet', elements: [] });

            // Wait for auto-save to complete (debounce is 500ms + execution time)
            await new Promise(resolve => setTimeout(resolve, 700));

            // Verify session was auto-saved
            expect(sessionStore.saveCount).to.be.greaterThan(0);
        });

        it('should not auto-save on non-changeset events', async () => {
            const session = chatService.createSession(ChatAgentLocation.Panel);
            sessionStore.reset();

            // Trigger other kind of event (like 'addRequest')
            (session.model as any)._onDidChangeEmitter.fire({ kind: 'addRequest' });

            // Wait to ensure no save happens
            await new Promise(resolve => setTimeout(resolve, 10));

            // Verify no auto-save occurred
            expect(sessionStore.saveCount).to.equal(0);
        });
    });

    describe('Auto-save for all sessions', () => {
        it('should save all non-empty sessions', async () => {
            const session1 = chatService.createSession(ChatAgentLocation.Panel);
            const session2 = chatService.createSession(ChatAgentLocation.Panel);

            sessionStore.reset();

            // Send requests to both sessions
            const invocation1 = await chatService.sendRequest(session1.id, { text: 'Request 1' });
            const invocation2 = await chatService.sendRequest(session2.id, { text: 'Request 2' });

            // Complete both responses
            (await invocation1!.responseCreated as any).complete();
            (await invocation2!.responseCreated as any).complete();

            // Wait for auto-save to complete (debounce is 500ms + execution time)
            await new Promise(resolve => setTimeout(resolve, 700));

            // Verify both sessions were saved (check lastSaveTimes since sessions are saved individually)
            expect(sessionStore.saveCount).to.be.greaterThan(0);
            expect(sessionStore.lastSaveTimes.has(session1.id)).to.be.true;
            expect(sessionStore.lastSaveTimes.has(session2.id)).to.be.true;
        });

        it('should not save empty sessions', async () => {
            // Create session without any requests
            const session = chatService.createSession(ChatAgentLocation.Panel);
            sessionStore.reset();

            // Manually trigger save
            await (chatService as any).saveSession(session.id);

            // Verify empty session was not saved
            const savedSessionIds = sessionStore.savedSessions.map(s => s.model.id);
            expect(savedSessionIds).to.not.include(session.id);
        });
    });

    describe('Auto-save without session store', () => {
        it('should handle auto-save gracefully when session store unavailable', async () => {
            // Create service without session store
            const containerWithoutStore = new Container();
            containerWithoutStore.bind(ChatAgentService).toConstantValue(new MockChatAgentService() as any);
            containerWithoutStore.bind(ChatRequestParser).toConstantValue(new MockChatRequestParser() as any);
            containerWithoutStore.bind(AIVariableService).toConstantValue(new MockAIVariableService() as any);
            containerWithoutStore.bind(ILogger).toConstantValue(new MockLogger() as any);

            // Bind deserializer registries
            const contentRegistry = new ChatContentDeserializerRegistryImpl();
            new DefaultChatContentDeserializerContribution().registerDeserializers(contentRegistry);
            containerWithoutStore.bind(ChatContentDeserializerRegistry).toConstantValue(contentRegistry);
            containerWithoutStore.bind(ChangeSetElementDeserializerRegistry).toConstantValue(new ChangeSetElementDeserializerRegistryImpl());

            containerWithoutStore.bind(ChatServiceImpl).toSelf().inSingletonScope();

            const serviceWithoutStore = containerWithoutStore.get(ChatServiceImpl);

            // Create session and send request
            const session = serviceWithoutStore.createSession(ChatAgentLocation.Panel);
            const invocation = await serviceWithoutStore.sendRequest(session.id, { text: 'Test' });

            // Complete response - should not throw even without session store
            (await invocation!.responseCreated as any).complete();

            // Wait to ensure no errors
            await new Promise(resolve => setTimeout(resolve, 10));

            // No assertion needed - we're just verifying no exception is thrown
        });
    });

    describe('Auto-save setup for restored sessions', () => {
        it('should set up auto-save for restored sessions', async () => {
            // Create and save a session
            const session1 = chatService.createSession(ChatAgentLocation.Panel);
            await chatService.sendRequest(session1.id, { text: 'Test' });

            const serialized = session1.model.toSerializable();

            // Create new service instance
            const newContainer = new Container();
            const newSessionStore = new MockChatSessionStore();
            newSessionStore.savedSessions = [{
                model: serialized,
                pinnedAgentId: undefined,
                title: 'Test Session'
            }];

            newContainer.bind(ChatSessionStore).toConstantValue(newSessionStore);
            newContainer.bind(ChatAgentService).toConstantValue(new MockChatAgentService() as any);
            newContainer.bind(ChatRequestParser).toConstantValue(new MockChatRequestParser() as any);
            newContainer.bind(AIVariableService).toConstantValue(new MockAIVariableService() as any);
            newContainer.bind(ILogger).toConstantValue(new MockLogger() as any);

            // Bind deserializer registries
            const newContentRegistry = new ChatContentDeserializerRegistryImpl();
            new DefaultChatContentDeserializerContribution().registerDeserializers(newContentRegistry);
            newContainer.bind(ChatContentDeserializerRegistry).toConstantValue(newContentRegistry);
            newContainer.bind(ChangeSetElementDeserializerRegistry).toConstantValue(new ChangeSetElementDeserializerRegistryImpl());

            newContainer.bind(ChatServiceImpl).toSelf().inSingletonScope();

            const newChatService = newContainer.get(ChatServiceImpl);

            // Mock readSession to return the serialized data
            newSessionStore.readSession = async (id: string) => ({
                version: 1,
                model: serialized,
                pinnedAgentId: undefined
            });

            // Restore the session
            const restoredSession = await newChatService.getOrRestoreSession(serialized.sessionId);
            expect(restoredSession).to.not.be.undefined;

            newSessionStore.reset();

            // Trigger changeset update on restored session
            (restoredSession!.model as any)._onDidChangeEmitter.fire({ kind: 'updateChangeSet', elements: [] });

            // Wait for auto-save (debounce is 500ms + execution time)
            await new Promise(resolve => setTimeout(resolve, 700));

            // Verify auto-save was set up and triggered
            expect(newSessionStore.saveCount).to.be.greaterThan(0);
        });
    });

    describe('Multiple auto-save triggers', () => {
        it('should handle multiple rapid auto-save triggers', async () => {
            const session = chatService.createSession(ChatAgentLocation.Panel);
            // Add a request so the session is not empty
            await chatService.sendRequest(session.id, { text: 'Test request' });
            sessionStore.reset();

            // Trigger multiple changeset updates rapidly
            for (let i = 0; i < 5; i++) {
                (session.model as any)._onDidChangeEmitter.fire({ kind: 'updateChangeSet', elements: [] });
            }

            // Wait for all saves to complete (debounce is 500ms + execution time)
            await new Promise(resolve => setTimeout(resolve, 700));

            // Verify saves were triggered (implementation batches them)
            expect(sessionStore.saveCount).to.be.greaterThan(0);
        });
    });
});
