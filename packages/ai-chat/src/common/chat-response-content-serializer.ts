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

import { URI } from '@theia/core';
import { MarkdownStringImpl } from '@theia/core/lib/common/markdown-rendering';
import { ChatResponseContent, TextChatResponseContent, MarkdownChatResponseContent, CodeChatResponseContent, 
         ErrorChatResponseContent, InformationalChatResponseContent, CommandChatResponseContent, 
         HorizontalLayoutChatResponseContent, ToolCallChatResponseContent, ThinkingChatResponseContent,
         ProgressChatResponseContent, TextChatResponseContentImpl, MarkdownChatResponseContentImpl, 
         CodeChatResponseContentImpl, ErrorChatResponseContentImpl, InformationalChatResponseContentImpl,
         CommandChatResponseContentImpl, HorizontalLayoutChatResponseContentImpl, 
         ToolCallChatResponseContentImpl, ThinkingChatResponseContentImpl, ProgressChatResponseContentImpl,
         Location } from './chat-model';
import { Command } from '@theia/core';

export const CHAT_RESPONSE_CONTENT_SERIALIZER_CONTRIBUTION_TOKEN = Symbol('ChatResponseContentSerializer');

/**
 * Interface for serializing and deserializing specific types of ChatResponseContent
 */
export interface ChatResponseContentSerializer {
    /**
     * Check if this serializer can handle the given content
     */
    canHandle(content: ChatResponseContent): boolean;
    
    /**
     * Check if this serializer can handle content of the given kind
     */
    canHandleKind(kind: string): boolean;
    
    /**
     * Serialize the content to a JSON-serializable object
     */
    serialize(content: ChatResponseContent): unknown;
    
    /**
     * Deserialize the data back to ChatResponseContent
     */
    deserialize(data: unknown): ChatResponseContent;
}

/**********************
 * BUILT-IN SERIALIZERS
 **********************/

export class TextChatResponseContentSerializer implements ChatResponseContentSerializer {
    canHandle(content: ChatResponseContent): boolean {
        return TextChatResponseContent.is(content);
    }
    
    canHandleKind(kind: string): boolean {
        return kind === 'text';
    }
    
    serialize(content: ChatResponseContent): unknown {
        if (!TextChatResponseContent.is(content)) {
            throw new Error('Cannot serialize non-text content');
        }
        return {
            content: content.content
        };
    }
    
    deserialize(data: unknown): ChatResponseContent {
        if (typeof data !== 'object' || data === null || !('content' in data) || typeof data.content !== 'string') {
            throw new Error('Invalid text content data');
        }
        return new TextChatResponseContentImpl(data.content);
    }
}

export class MarkdownChatResponseContentSerializer implements ChatResponseContentSerializer {
    canHandle(content: ChatResponseContent): boolean {
        return MarkdownChatResponseContent.is(content);
    }
    
    canHandleKind(kind: string): boolean {
        return kind === 'markdownContent';
    }
    
    serialize(content: ChatResponseContent): unknown {
        if (!MarkdownChatResponseContent.is(content)) {
            throw new Error('Cannot serialize non-markdown content');
        }
        return {
            value: content.content.value,
            supportMarkdown: content.content.supportMarkdown,
            isTrusted: content.content.isTrusted
        };
    }
    
    deserialize(data: unknown): ChatResponseContent {
        if (typeof data !== 'object' || data === null || !('value' in data) || typeof data.value !== 'string') {
            throw new Error('Invalid markdown content data');
        }
        const typedData = data as { value: string; supportMarkdown?: boolean; isTrusted?: boolean };
        return new MarkdownChatResponseContentImpl(typedData.value);
    }
}

export class CodeChatResponseContentSerializer implements ChatResponseContentSerializer {
    canHandle(content: ChatResponseContent): boolean {
        return CodeChatResponseContent.is(content);
    }
    
    canHandleKind(kind: string): boolean {
        return kind === 'code';
    }
    
    serialize(content: ChatResponseContent): unknown {
        if (!CodeChatResponseContent.is(content)) {
            throw new Error('Cannot serialize non-code content');
        }
        return {
            code: content.code,
            language: content.language,
            location: content.location ? {
                uri: content.location.uri.toString(),
                position: content.location.position
            } : undefined
        };
    }
    
    deserialize(data: unknown): ChatResponseContent {
        if (typeof data !== 'object' || data === null || !('code' in data) || typeof data.code !== 'string') {
            throw new Error('Invalid code content data');
        }
        const typedData = data as { 
            code: string; 
            language?: string; 
            location?: { uri: string; position: { line: number; character: number } } 
        };
        
        const location: Location | undefined = typedData.location ? {
            uri: URI.parse(typedData.location.uri),
            position: typedData.location.position
        } : undefined;
        
        return new CodeChatResponseContentImpl(typedData.code, typedData.language, location);
    }
}

export class ErrorChatResponseContentSerializer implements ChatResponseContentSerializer {
    canHandle(content: ChatResponseContent): boolean {
        return ErrorChatResponseContent.is(content);
    }
    
    canHandleKind(kind: string): boolean {
        return kind === 'error';
    }
    
    serialize(content: ChatResponseContent): unknown {
        if (!ErrorChatResponseContent.is(content)) {
            throw new Error('Cannot serialize non-error content');
        }
        return {
            message: content.error.message,
            name: content.error.name,
            stack: content.error.stack
        };
    }
    
    deserialize(data: unknown): ChatResponseContent {
        if (typeof data !== 'object' || data === null || !('message' in data) || typeof data.message !== 'string') {
            throw new Error('Invalid error content data');
        }
        const typedData = data as { message: string; name?: string; stack?: string };
        const error = new Error(typedData.message);
        if (typedData.name) {
            error.name = typedData.name;
        }
        if (typedData.stack) {
            error.stack = typedData.stack;
        }
        return new ErrorChatResponseContentImpl(error);
    }
}

export class InformationalChatResponseContentSerializer implements ChatResponseContentSerializer {
    canHandle(content: ChatResponseContent): boolean {
        return InformationalChatResponseContent.is(content);
    }
    
    canHandleKind(kind: string): boolean {
        return kind === 'informational';
    }
    
    serialize(content: ChatResponseContent): unknown {
        if (!InformationalChatResponseContent.is(content)) {
            throw new Error('Cannot serialize non-informational content');
        }
        return {
            value: content.content.value,
            supportMarkdown: content.content.supportMarkdown,
            isTrusted: content.content.isTrusted
        };
    }
    
    deserialize(data: unknown): ChatResponseContent {
        if (typeof data !== 'object' || data === null || !('value' in data) || typeof data.value !== 'string') {
            throw new Error('Invalid informational content data');
        }
        const typedData = data as { value: string; supportMarkdown?: boolean; isTrusted?: boolean };
        return new InformationalChatResponseContentImpl(typedData.value);
    }
}

export class CommandChatResponseContentSerializer implements ChatResponseContentSerializer {
    canHandle(content: ChatResponseContent): boolean {
        return CommandChatResponseContent.is(content);
    }
    
    canHandleKind(kind: string): boolean {
        return kind === 'command';
    }
    
    serialize(content: ChatResponseContent): unknown {
        if (!CommandChatResponseContent.is(content)) {
            throw new Error('Cannot serialize non-command content');
        }
        return {
            command: content.command,
            customCallback: content.customCallback ? {
                label: content.customCallback.label
                // Note: We cannot serialize the callback function itself
            } : undefined,
            arguments: content.arguments
        };
    }
    
    deserialize(data: unknown): ChatResponseContent {
        if (typeof data !== 'object' || data === null) {
            throw new Error('Invalid command content data');
        }
        const typedData = data as { 
            command?: Command; 
            customCallback?: { label: string }; 
            arguments?: unknown[] 
        };
        
        // Note: CustomCallback cannot be fully restored since we can't serialize functions
        // The customCallback will be undefined after deserialization
        return new CommandChatResponseContentImpl(typedData.command, undefined, typedData.arguments);
    }
}

export class HorizontalLayoutChatResponseContentSerializer implements ChatResponseContentSerializer {
    canHandle(content: ChatResponseContent): boolean {
        return HorizontalLayoutChatResponseContent.is(content);
    }
    
    canHandleKind(kind: string): boolean {
        return kind === 'horizontal';
    }
    
    serialize(content: ChatResponseContent): unknown {
        if (!HorizontalLayoutChatResponseContent.is(content)) {
            throw new Error('Cannot serialize non-horizontal layout content');
        }
        // Note: This is a simplified serialization that doesn't handle nested content
        // For a full implementation, we would need to recursively serialize child content
        return {
            contentCount: content.content.length,
            contentKinds: content.content.map(child => child.kind),
            asString: content.asString()
        };
    }
    
    deserialize(data: unknown): ChatResponseContent {
        if (typeof data !== 'object' || data === null) {
            throw new Error('Invalid horizontal layout content data');
        }
        const typedData = data as { asString?: string };
        
        // Create a simple text representation since we can't fully restore nested content
        const fallbackText = typedData.asString || '[Horizontal Layout Content]';
        const fallbackContent = new TextChatResponseContentImpl(fallbackText);
        
        return new HorizontalLayoutChatResponseContentImpl([fallbackContent]);
    }
}

export class ToolCallChatResponseContentSerializer implements ChatResponseContentSerializer {
    canHandle(content: ChatResponseContent): boolean {
        return ToolCallChatResponseContent.is(content);
    }
    
    canHandleKind(kind: string): boolean {
        return kind === 'toolCall';
    }
    
    serialize(content: ChatResponseContent): unknown {
        if (!ToolCallChatResponseContent.is(content)) {
            throw new Error('Cannot serialize non-tool call content');
        }
        return {
            id: content.id,
            name: content.name,
            arguments: content.arguments,
            finished: content.finished,
            result: content.result
            // Note: We cannot serialize the confirmation promise
        };
    }
    
    deserialize(data: unknown): ChatResponseContent {
        if (typeof data !== 'object' || data === null) {
            throw new Error('Invalid tool call content data');
        }
        const typedData = data as { 
            id?: string; 
            name?: string; 
            arguments?: string; 
            finished?: boolean; 
            result?: string 
        };
        
        return new ToolCallChatResponseContentImpl(
            typedData.id,
            typedData.name,
            typedData.arguments,
            typedData.finished,
            typedData.result
        );
    }
}

export class ThinkingChatResponseContentSerializer implements ChatResponseContentSerializer {
    canHandle(content: ChatResponseContent): boolean {
        return ThinkingChatResponseContent.is(content);
    }
    
    canHandleKind(kind: string): boolean {
        return kind === 'thinking';
    }
    
    serialize(content: ChatResponseContent): unknown {
        if (!ThinkingChatResponseContent.is(content)) {
            throw new Error('Cannot serialize non-thinking content');
        }
        return {
            content: content.content,
            signature: content.signature
        };
    }
    
    deserialize(data: unknown): ChatResponseContent {
        if (typeof data !== 'object' || data === null || !('content' in data) || !('signature' in data) ||
            typeof data.content !== 'string' || typeof data.signature !== 'string') {
            throw new Error('Invalid thinking content data');
        }
        const typedData = data as { content: string; signature: string };
        return new ThinkingChatResponseContentImpl(typedData.content, typedData.signature);
    }
}

export class ProgressChatResponseContentSerializer implements ChatResponseContentSerializer {
    canHandle(content: ChatResponseContent): boolean {
        return ProgressChatResponseContent.is(content);
    }
    
    canHandleKind(kind: string): boolean {
        return kind === 'progress';
    }
    
    serialize(content: ChatResponseContent): unknown {
        if (!ProgressChatResponseContent.is(content)) {
            throw new Error('Cannot serialize non-progress content');
        }
        return {
            message: content.message
        };
    }
    
    deserialize(data: unknown): ChatResponseContent {
        if (typeof data !== 'object' || data === null || !('message' in data) || typeof data.message !== 'string') {
            throw new Error('Invalid progress content data');
        }
        const typedData = data as { message: string };
        return new ProgressChatResponseContentImpl(typedData.message);
    }
}