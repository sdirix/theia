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

import { inject, injectable } from '@theia/core/shared/inversify';
import { Emitter, Event } from '@theia/core';
import { StorageService } from '@theia/core/lib/browser/storage-service';
import { ChatAgentLocation, ChatModelSerializer, MutableChatModel } from '../common';
import { SerializableChatData } from '../common/chat-model-serializer';

/**
 * Configuration for the chat persistence service.
 */
export interface ChatPersistenceConfiguration {
    /**
     * The maximum number of chat sessions to store.
     * When this limit is reached, the oldest sessions will be removed.
     */
    readonly maxStoredSessions: number;

    /**
     * The storage key prefix used for storing chat sessions.
     */
    readonly storageKeyPrefix: string;

    /**
     * The storage key used for the session index.
     */
    readonly sessionIndexKey: string;
}

/**
 * Default configuration for the chat persistence service.
 */
export const DEFAULT_CHAT_PERSISTENCE_CONFIG: ChatPersistenceConfiguration = {
    maxStoredSessions: 10,
    storageKeyPrefix: 'theia-ai-chat-session-',
    sessionIndexKey: 'theia-ai-chat-session-index'
};

/**
 * Information about a stored chat session.
 */
export interface StoredChatSessionInfo {
    /**
     * The unique identifier of the chat session.
     */
    readonly id: string;

    /**
     * The timestamp when the chat session was created.
     */
    readonly creationDate: number;

    /**
     * The timestamp of the last message in the chat session.
     */
    readonly lastMessageDate: number;

    /**
     * The custom title of the chat session, if any.
     */
    readonly customTitle?: string;

    /**
     * The location of the chat session.
     */
    readonly location: ChatAgentLocation;
}

/**
 * Service for persisting and restoring chat sessions.
 */
@injectable()
export class ChatPersistenceService {
    @inject(StorageService)
    protected readonly storageService: StorageService;

    @inject(ChatModelSerializer)
    protected readonly chatModelSerializer: ChatModelSerializer;

    protected readonly config: ChatPersistenceConfiguration = DEFAULT_CHAT_PERSISTENCE_CONFIG;

    protected readonly onDidChangeSessionsEmitter = new Emitter<void>();
    readonly onDidChangeSessions: Event<void> = this.onDidChangeSessionsEmitter.event;

    /**
     * Saves a chat session to storage.
     * @param chatModel The chat model to save.
     */
    async saveSession(chatModel: MutableChatModel): Promise<void> {
        try {
            // Serialize the chat model
            const serializedData = this.chatModelSerializer.serialize(chatModel);

            // Store the serialized data
            await this.storageService.setData(
                this.getSessionStorageKey(chatModel.id),
                JSON.stringify(serializedData)
            );

            // Update the session index
            await this.updateSessionIndex(chatModel.id, {
                id: chatModel.id,
                creationDate: chatModel.creationDate,
                lastMessageDate: chatModel.lastMessageDate,
                customTitle: chatModel.customTitle,
                location: chatModel.location
            });

            this.onDidChangeSessionsEmitter.fire();
        } catch (error) {
            console.error('Failed to save chat session:', error);
        }
    }

    /**
     * Loads a chat session from storage.
     * @param sessionId The ID of the session to load.
     * @returns The loaded chat model, or undefined if not found.
     */
    async loadSession(sessionId: string): Promise<MutableChatModel | undefined> {
        try {
            const serializedDataStr = await this.storageService.getData<string>(this.getSessionStorageKey(sessionId));
            if (!serializedDataStr) {
                return undefined;
            }

            const serializedData = JSON.parse(serializedDataStr) as SerializableChatData;
            return this.chatModelSerializer.deserialize(serializedData);
        } catch (error) {
            console.error(`Failed to load chat session ${sessionId}:`, error);
            return undefined;
        }
    }

    /**
     * Deletes a chat session from storage.
     * @param sessionId The ID of the session to delete.
     */
    async deleteSession(sessionId: string): Promise<void> {
        try {
            // Remove the session data by setting it to undefined
            await this.storageService.setData(this.getSessionStorageKey(sessionId), undefined);

            // Update the session index
            await this.removeFromSessionIndex(sessionId);

            this.onDidChangeSessionsEmitter.fire();
        } catch (error) {
            console.error(`Failed to delete chat session ${sessionId}:`, error);
        }
    }

    /**
     * Gets information about all stored chat sessions.
     * @returns An array of stored chat session information.
     */
    async getStoredSessionsInfo(): Promise<StoredChatSessionInfo[]> {
        try {
            const indexStr = await this.storageService.getData<string>(this.config.sessionIndexKey);
            if (!indexStr) {
                return [];
            }

            return JSON.parse(indexStr) as StoredChatSessionInfo[];
        } catch (error) {
            console.error('Failed to get stored sessions info:', error);
            return [];
        }
    }

    /**
     * Loads all stored chat sessions.
     * @returns An array of loaded chat models.
     */
    async loadAllSessions(): Promise<MutableChatModel[]> {
        const sessionsInfo = await this.getStoredSessionsInfo();
        const loadedSessions: MutableChatModel[] = [];

        for (const sessionInfo of sessionsInfo) {
            const session = await this.loadSession(sessionInfo.id);
            if (session) {
                loadedSessions.push(session);
            }
        }

        return loadedSessions;
    }

    /**
     * Updates the session index with information about a chat session.
     * @param sessionId The ID of the session.
     * @param info Information about the session.
     */
    protected async updateSessionIndex(sessionId: string, info: StoredChatSessionInfo): Promise<void> {
        const sessionsInfo = await this.getStoredSessionsInfo();

        // Remove the session if it already exists in the index
        const existingIndex = sessionsInfo.findIndex(s => s.id === sessionId);
        if (existingIndex !== -1) {
            sessionsInfo.splice(existingIndex, 1);
        }

        // Add the session to the index
        sessionsInfo.push(info);

        // Sort sessions by last message date (newest first)
        sessionsInfo.sort((a, b) => b.lastMessageDate - a.lastMessageDate);

        // Limit the number of stored sessions
        if (sessionsInfo.length > this.config.maxStoredSessions) {
            const sessionsToRemove = sessionsInfo.splice(this.config.maxStoredSessions);

            // Remove the data for the removed sessions
            for (const session of sessionsToRemove) {
                await this.storageService.setData(this.getSessionStorageKey(session.id), undefined);
            }
        }

        // Save the updated index
        await this.storageService.setData(
            this.config.sessionIndexKey,
            JSON.stringify(sessionsInfo)
        );
    }

    /**
     * Removes a session from the session index.
     * @param sessionId The ID of the session to remove.
     */
    protected async removeFromSessionIndex(sessionId: string): Promise<void> {
        const sessionsInfo = await this.getStoredSessionsInfo();

        const updatedSessionsInfo = sessionsInfo.filter(s => s.id !== sessionId);

        await this.storageService.setData(
            this.config.sessionIndexKey,
            JSON.stringify(updatedSessionsInfo)
        );
    }

    /**
     * Gets the storage key for a chat session.
     * @param sessionId The ID of the session.
     * @returns The storage key.
     */
    protected getSessionStorageKey(sessionId: string): string {
        return `${this.config.storageKeyPrefix}${sessionId}`;
    }
}
