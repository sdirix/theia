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

import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { ChatAgent, ChatAgentLocation, ChatChangeEvent, ChatServiceImpl, ChatSession, MutableChatModel, ParsedChatRequest, SessionOptions } from '../common';

/**
 * Internal interface for chat sessions with a mutable model.
 */
interface ChatSessionInternal extends ChatSession {
    model: MutableChatModel;
}
import { PreferenceService } from '@theia/core/lib/browser';
import { DEFAULT_CHAT_AGENT_PREF, PIN_CHAT_AGENT_PREF } from './ai-chat-preferences';
import { ChangeSetFileService } from './change-set-file-service';
import { ChatPersistenceService } from './chat-persistence-service';
import { Disposable, DisposableCollection } from '@theia/core';

/**
 * Customizes the ChatServiceImpl to consider preference based default chat agent
 */
@injectable()
export class FrontendChatServiceImpl extends ChatServiceImpl {

    @inject(PreferenceService)
    protected readonly preferenceService: PreferenceService;

    @inject(ChangeSetFileService)
    protected readonly changeSetFileService: ChangeSetFileService;

    @inject(ChatPersistenceService)
    protected readonly chatPersistenceService: ChatPersistenceService;

    protected readonly toDispose = new DisposableCollection();

    // Map of session IDs to disposables for tracking session changes
    protected readonly sessionDisposables = new Map<string, Disposable>();

    protected override getAgent(parsedRequest: ParsedChatRequest, session: ChatSession): ChatAgent | undefined {
        let agent = this.initialAgentSelection(parsedRequest);
        if (!this.preferenceService.get<boolean>(PIN_CHAT_AGENT_PREF)) {
            return agent;
        }
        if (!session.pinnedAgent && agent && agent.id !== this.defaultChatAgentId?.id) {
            session.pinnedAgent = agent;
        } else if (session.pinnedAgent && this.getMentionedAgent(parsedRequest) === undefined) {
            agent = session.pinnedAgent;
        }
        return agent;
    }

    protected override initialAgentSelection(parsedRequest: ParsedChatRequest): ChatAgent | undefined {
        const agentPart = this.getMentionedAgent(parsedRequest);
        if (!agentPart) {
            const configuredDefaultChatAgent = this.getConfiguredDefaultChatAgent();
            if (configuredDefaultChatAgent) {
                return configuredDefaultChatAgent;
            }
        }
        return super.initialAgentSelection(parsedRequest);
    }

    protected getConfiguredDefaultChatAgent(): ChatAgent | undefined {
        const configuredDefaultChatAgentId = this.preferenceService.get<string>(DEFAULT_CHAT_AGENT_PREF, undefined);
        const configuredDefaultChatAgent = configuredDefaultChatAgentId ? this.chatAgentService.getAgent(configuredDefaultChatAgentId) : undefined;
        if (configuredDefaultChatAgentId && !configuredDefaultChatAgent) {
            this.logger.warn(`The configured default chat agent with id '${configuredDefaultChatAgentId}' does not exist.`);
        }
        return configuredDefaultChatAgent;
    }

    @postConstruct()
    protected init(): void {
        // Load persisted sessions when the service is initialized
        this.loadPersistedSessions().catch(error =>
            this.logger.error('Failed to load persisted chat sessions:', error)
        );

        this.toDispose.push(Disposable.create(() => {
            // Clean up session disposables when the service is disposed
            for (const disposable of this.sessionDisposables.values()) {
                disposable.dispose();
            }
            this.sessionDisposables.clear();
        }));
    }

    /**
     * Loads persisted chat sessions from storage.
     */
    protected async loadPersistedSessions(): Promise<void> {
        try {
            const sessions = await this.chatPersistenceService.loadAllSessions();

            for (const model of sessions) {
                // Create a session for each loaded model
                this.createSessionFromModel(model);
            }

            this.logger.info(`Loaded ${sessions.length} persisted chat sessions`);
        } catch (error) {
            this.logger.error('Error loading persisted chat sessions:', error);
        }
    }

    /**
     * Creates a chat session from a loaded chat model.
     */
    protected createSessionFromModel(model: MutableChatModel): ChatSession {
        // Create a new session with the loaded model
        const session: ChatSession = {
            id: model.id,
            model,
            isActive: false,
            lastInteraction: new Date(model.lastMessageDate)
        };

        // Add the session to the internal sessions array
        this._sessions.push(session as ChatSessionInternal);

        // Set up persistence for the session
        this.setupSessionPersistence(session);

        // Fire the session created event
        this.onSessionEventEmitter.fire({ type: 'created', sessionId: session.id });

        return session;
    }

    override createSession(location?: ChatAgentLocation, options?: SessionOptions, pinnedAgent?: ChatAgent): ChatSession {
        const session = super.createSession(location, options, pinnedAgent);

        // Set up change set handling
        session.model.onDidChange(event => {
            if (ChatChangeEvent.isChangeSetEvent(event)) {
                this.changeSetFileService.closeDiffsForSession(session.id, session.model.changeSet.getElements().map(({ uri }) => uri));
            }
        });

        // Set up persistence for the session
        this.setupSessionPersistence(session);

        return session;
    }

    /**
     * Sets up persistence for a chat session.
     */
    protected setupSessionPersistence(session: ChatSession): void {
        // Clean up any existing disposables for this session
        const existingDisposable = this.sessionDisposables.get(session.id);
        if (existingDisposable) {
            existingDisposable.dispose();
        }

        // Create a new disposable collection for this session
        const disposables = new DisposableCollection();

        // Save the session whenever it changes
        disposables.push(
            session.model.onDidChange(async () => {
                try {
                    await this.chatPersistenceService.saveSession(session.model as MutableChatModel);
                } catch (error) {
                    this.logger.error(`Failed to save chat session ${session.id}:`, error);
                }
            })
        );

        // Save the session initially
        this.chatPersistenceService.saveSession(session.model as MutableChatModel)
            .catch(error => this.logger.error(`Failed to save initial chat session ${session.id}:`, error));

        // Store the disposables
        this.sessionDisposables.set(session.id, disposables);
    }

    /**
     * Cleans up resources for a session when it's deleted.
     */
    protected cleanupSession(sessionId: string): void {
        // Clean up persistence disposables
        const disposable = this.sessionDisposables.get(sessionId);
        if (disposable) {
            disposable.dispose();
            this.sessionDisposables.delete(sessionId);
        }
    }

    /**
     * Override deleteSession to clean up persistence resources.
     */
    override deleteSession(sessionId: string): void {
        this.cleanupSession(sessionId);
        super.deleteSession(sessionId);
    }

    /**
     * Dispose of all resources.
     */
    dispose(): void {
        this.toDispose.dispose();
    }
}
