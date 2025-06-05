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
import { URI } from '@theia/core';
import {
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
import {
    TextChatResponseContentImpl,
    MarkdownChatResponseContentImpl,
    CodeChatResponseContentImpl,
    ErrorChatResponseContentImpl,
    InformationalChatResponseContentImpl,
    CommandChatResponseContentImpl,
    HorizontalLayoutChatResponseContentImpl,
    ToolCallChatResponseContentImpl,
    ThinkingChatResponseContentImpl,
    ProgressChatResponseContentImpl,
    TextChatResponseContent,
    MarkdownChatResponseContent,
    CodeChatResponseContent,
    ErrorChatResponseContent,
    InformationalChatResponseContent,
    CommandChatResponseContent,
    HorizontalLayoutChatResponseContent,
    ToolCallChatResponseContent,
    ThinkingChatResponseContent,
    ProgressChatResponseContent
} from './chat-model';

describe('ChatResponseContentSerializers', () => {

    describe('TextChatResponseContentSerializer', () => {
        let serializer: TextChatResponseContentSerializer;

        beforeEach(() => {
            serializer = new TextChatResponseContentSerializer();
        });

        it('should handle text content', () => {
            const content = new TextChatResponseContentImpl('Hello world');
            expect(serializer.canHandle(content)).to.be.true;
            expect(serializer.canHandleKind('text')).to.be.true;
            expect(serializer.canHandleKind('markdown')).to.be.false;
        });

        it('should serialize text content', () => {
            const content = new TextChatResponseContentImpl('Hello world');
            const serialized = serializer.serialize(content);

            expect(serialized).to.deep.equal({
                content: 'Hello world'
            });
        });

        it('should deserialize text content', () => {
            const data = { content: 'Hello world' };
            const content = serializer.deserialize(data) as TextChatResponseContent;

            expect(TextChatResponseContent.is(content)).to.be.true;
            expect(content.content).to.equal('Hello world');
            expect(content.asString()).to.equal('Hello world');
        });

        it('should throw error for invalid content type', () => {
            const content = new MarkdownChatResponseContentImpl('markdown');
            expect(() => serializer.serialize(content)).to.throw('Cannot serialize non-text content');
        });

        it('should throw error for invalid data format', () => {
            expect(() => serializer.deserialize({ notContent: 'invalid' })).to.throw('Invalid text content data');
            expect(() => serializer.deserialize(undefined)).to.throw('Invalid text content data');
            expect(() => serializer.deserialize('string')).to.throw('Invalid text content data');
        });
    });

    describe('MarkdownChatResponseContentSerializer', () => {
        let serializer: MarkdownChatResponseContentSerializer;

        beforeEach(() => {
            serializer = new MarkdownChatResponseContentSerializer();
        });

        it('should handle markdown content', () => {
            const content = new MarkdownChatResponseContentImpl('**bold**');
            expect(serializer.canHandle(content)).to.be.true;
            expect(serializer.canHandleKind('markdownContent')).to.be.true;
        });

        it('should serialize markdown content', () => {
            const content = new MarkdownChatResponseContentImpl('**bold**');
            const serialized = serializer.serialize(content);

            expect(serialized).to.deep.include({
                value: '**bold**'
            });
        });

        it('should deserialize markdown content', () => {
            const data = { value: '**bold**', supportMarkdown: true };
            const content = serializer.deserialize(data) as MarkdownChatResponseContent;

            expect(MarkdownChatResponseContent.is(content)).to.be.true;
            expect(content.content.value).to.equal('**bold**');
        });
    });

    describe('CodeChatResponseContentSerializer', () => {
        let serializer: CodeChatResponseContentSerializer;

        beforeEach(() => {
            serializer = new CodeChatResponseContentSerializer();
        });

        it('should handle code content', () => {
            const content = new CodeChatResponseContentImpl('console.log("hello")', 'javascript');
            expect(serializer.canHandle(content)).to.be.true;
            expect(serializer.canHandleKind('code')).to.be.true;
        });

        it('should serialize code content with location', () => {
            const location = {
                uri: new URI('file:///test.js'),
                position: { line: 10, character: 5 }
            };
            const content = new CodeChatResponseContentImpl('console.log("hello")', 'javascript', location);
            const serialized = serializer.serialize(content);

            expect(serialized).to.deep.equal({
                code: 'console.log("hello")',
                language: 'javascript',
                location: {
                    uri: 'file:///test.js',
                    position: { line: 10, character: 5 }
                }
            });
        });

        it('should serialize code content without location', () => {
            const content = new CodeChatResponseContentImpl('console.log("hello")', 'javascript');
            const serialized = serializer.serialize(content);

            expect(serialized).to.deep.equal({
                code: 'console.log("hello")',
                language: 'javascript',
                location: undefined
            });
        });

        it('should deserialize code content with location', () => {
            const data = {
                code: 'console.log("hello")',
                language: 'javascript',
                location: {
                    uri: 'file:///test.js',
                    position: { line: 10, character: 5 }
                }
            };
            const content = serializer.deserialize(data) as CodeChatResponseContent;

            expect(CodeChatResponseContent.is(content)).to.be.true;
            expect(content.code).to.equal('console.log("hello")');
            expect(content.language).to.equal('javascript');
            expect(content.location?.uri.toString()).to.equal('file:///test.js');
            expect(content.location?.position).to.deep.equal({ line: 10, character: 5 });
        });
    });

    describe('ErrorChatResponseContentSerializer', () => {
        let serializer: ErrorChatResponseContentSerializer;

        beforeEach(() => {
            serializer = new ErrorChatResponseContentSerializer();
        });

        it('should handle error content', () => {
            const error = new Error('Test error');
            const content = new ErrorChatResponseContentImpl(error);
            expect(serializer.canHandle(content)).to.be.true;
            expect(serializer.canHandleKind('error')).to.be.true;
        });

        it('should serialize error content', () => {
            const error = new Error('Test error');
            error.name = 'CustomError';
            error.stack = 'stack trace';
            const content = new ErrorChatResponseContentImpl(error);
            const serialized = serializer.serialize(content);

            expect(serialized).to.deep.equal({
                message: 'Test error',
                name: 'CustomError',
                stack: 'stack trace'
            });
        });

        it('should deserialize error content', () => {
            const data = {
                message: 'Test error',
                name: 'CustomError',
                stack: 'stack trace'
            };
            const content = serializer.deserialize(data) as ErrorChatResponseContent;

            expect(ErrorChatResponseContent.is(content)).to.be.true;
            expect(content.error.message).to.equal('Test error');
            expect(content.error.name).to.equal('CustomError');
            expect(content.error.stack).to.equal('stack trace');
        });
    });

    describe('ToolCallChatResponseContentSerializer', () => {
        let serializer: ToolCallChatResponseContentSerializer;

        beforeEach(() => {
            serializer = new ToolCallChatResponseContentSerializer();
        });

        it('should handle tool call content', () => {
            const content = new ToolCallChatResponseContentImpl('tool-1', 'searchWeb', '{"query": "test"}', true, 'result');
            expect(serializer.canHandle(content)).to.be.true;
            expect(serializer.canHandleKind('toolCall')).to.be.true;
        });

        it('should serialize tool call content', () => {
            const content = new ToolCallChatResponseContentImpl('tool-1', 'searchWeb', '{"query": "test"}', true, 'search result');
            const serialized = serializer.serialize(content);

            expect(serialized).to.deep.equal({
                id: 'tool-1',
                name: 'searchWeb',
                arguments: '{"query": "test"}',
                finished: true,
                result: 'search result'
            });
        });

        it('should deserialize tool call content', () => {
            const data = {
                id: 'tool-1',
                name: 'searchWeb',
                arguments: '{"query": "test"}',
                finished: true,
                result: 'search result'
            };
            const content = serializer.deserialize(data) as ToolCallChatResponseContent;

            expect(ToolCallChatResponseContent.is(content)).to.be.true;
            expect(content.id).to.equal('tool-1');
            expect(content.name).to.equal('searchWeb');
            expect(content.arguments).to.equal('{"query": "test"}');
            expect(content.finished).to.be.true;
            expect(content.result).to.equal('search result');
        });
    });

    describe('ThinkingChatResponseContentSerializer', () => {
        let serializer: ThinkingChatResponseContentSerializer;

        beforeEach(() => {
            serializer = new ThinkingChatResponseContentSerializer();
        });

        it('should handle thinking content', () => {
            const content = new ThinkingChatResponseContentImpl('thinking process', 'signature');
            expect(serializer.canHandle(content)).to.be.true;
            expect(serializer.canHandleKind('thinking')).to.be.true;
        });

        it('should serialize thinking content', () => {
            const content = new ThinkingChatResponseContentImpl('thinking process', 'signature');
            const serialized = serializer.serialize(content);

            expect(serialized).to.deep.equal({
                content: 'thinking process',
                signature: 'signature'
            });
        });

        it('should deserialize thinking content', () => {
            const data = {
                content: 'thinking process',
                signature: 'signature'
            };
            const content = serializer.deserialize(data) as ThinkingChatResponseContent;

            expect(ThinkingChatResponseContent.is(content)).to.be.true;
            expect(content.content).to.equal('thinking process');
            expect(content.signature).to.equal('signature');
        });
    });

    describe('ProgressChatResponseContentSerializer', () => {
        let serializer: ProgressChatResponseContentSerializer;

        beforeEach(function (): void {
            serializer = new ProgressChatResponseContentSerializer();
        });

        it('should handle progress content', () => {
            const content = new ProgressChatResponseContentImpl('Processing...');
            expect(serializer.canHandle(content)).to.be.true;
            expect(serializer.canHandleKind('progress')).to.be.true;
        });

        it('should serialize progress content', () => {
            const content = new ProgressChatResponseContentImpl('Processing...');
            const serialized = serializer.serialize(content);

            expect(serialized).to.deep.equal({
                message: 'Processing...'
            });
        });

        it('should deserialize progress content', () => {
            const data = { message: 'Processing...' };
            const content = serializer.deserialize(data) as ProgressChatResponseContent;

            expect(ProgressChatResponseContent.is(content)).to.be.true;
            expect(content.message).to.equal('Processing...');
        });
    });

    describe('CommandChatResponseContentSerializer', () => {
        let serializer: CommandChatResponseContentSerializer;

        beforeEach(() => {
            serializer = new CommandChatResponseContentSerializer();
        });

        it('should handle command content', () => {
            const command = { id: 'test.command', label: 'Test Command' };
            const content = new CommandChatResponseContentImpl(command);
            expect(serializer.canHandle(content)).to.be.true;
            expect(serializer.canHandleKind('command')).to.be.true;
        });

        it('should serialize command content', () => {
            const command = { id: 'test.command', label: 'Test Command' };
            const content = new CommandChatResponseContentImpl(command, undefined, ['arg1', 'arg2']);
            const serialized = serializer.serialize(content);

            expect(serialized).to.deep.equal({
                command: { id: 'test.command', label: 'Test Command' },
                customCallback: undefined,
                arguments: ['arg1', 'arg2']
            });
        });

        it('should serialize command content with custom callback', () => {
            const customCallback = {
                label: 'Custom Action',
                callback: async () => { /* empty callback */ }
            };
            const content = new CommandChatResponseContentImpl(undefined, customCallback);
            const serialized = serializer.serialize(content);

            expect(serialized).to.deep.equal({
                command: undefined,
                customCallback: { label: 'Custom Action' },
                arguments: []
            });
        });

        it('should deserialize command content', () => {
            const data = {
                command: { id: 'test.command', label: 'Test Command' },
                arguments: ['arg1', 'arg2']
            };
            const content = serializer.deserialize(data) as CommandChatResponseContent;

            expect(CommandChatResponseContent.is(content)).to.be.true;
            expect(content.command).to.deep.equal({ id: 'test.command', label: 'Test Command' });
            expect(content.arguments).to.deep.equal(['arg1', 'arg2']);
            expect(content.customCallback).to.be.undefined;
        });
    });

    describe('HorizontalLayoutChatResponseContentSerializer', () => {
        let serializer: HorizontalLayoutChatResponseContentSerializer;

        beforeEach(() => {
            serializer = new HorizontalLayoutChatResponseContentSerializer();
        });

        it('should handle horizontal layout content', () => {
            const childContent = [new TextChatResponseContentImpl('text1')];
            const content = new HorizontalLayoutChatResponseContentImpl(childContent);
            expect(serializer.canHandle(content)).to.be.true;
            expect(serializer.canHandleKind('horizontal')).to.be.true;
        });

        it('should serialize horizontal layout content', () => {
            const childContent = [
                new TextChatResponseContentImpl('text1'),
                new TextChatResponseContentImpl('text2')
            ];
            const content = new HorizontalLayoutChatResponseContentImpl(childContent);
            const serialized = serializer.serialize(content);

            expect(serialized).to.deep.equal({
                contentCount: 2,
                contentKinds: ['text', 'text'],
                asString: 'text1 text2'
            });
        });

        it('should deserialize horizontal layout content as fallback text', () => {
            const data = {
                contentCount: 2,
                contentKinds: ['text', 'text'],
                asString: 'text1 text2'
            };
            const content = serializer.deserialize(data) as HorizontalLayoutChatResponseContent;

            expect(HorizontalLayoutChatResponseContent.is(content)).to.be.true;
            expect(content.content).to.have.length(1);
            expect(content.content[0].kind).to.equal('text');
            expect((content.content[0] as TextChatResponseContent).content).to.equal('text1 text2');
        });

        it('should handle missing asString in deserialization', () => {
            const data = { contentCount: 1 };
            const content = serializer.deserialize(data) as HorizontalLayoutChatResponseContent;

            expect(content.content).to.have.length(1);
            expect((content.content[0] as TextChatResponseContent).content).to.equal('[Horizontal Layout Content]');
        });
    });

    describe('InformationalChatResponseContentSerializer', () => {
        let serializer: InformationalChatResponseContentSerializer;

        beforeEach(() => {
            serializer = new InformationalChatResponseContentSerializer();
        });

        it('should handle informational content', () => {
            const content = new InformationalChatResponseContentImpl('Info message');
            expect(serializer.canHandle(content)).to.be.true;
            expect(serializer.canHandleKind('informational')).to.be.true;
        });

        it('should serialize informational content', () => {
            const content = new InformationalChatResponseContentImpl('Info message');
            const serialized = serializer.serialize(content);

            expect(serialized).to.deep.include({
                value: 'Info message'
            });
        });

        it('should deserialize informational content', () => {
            const data = { value: 'Info message' };
            const content = serializer.deserialize(data) as InformationalChatResponseContent;

            expect(InformationalChatResponseContent.is(content)).to.be.true;
            expect(content.content.value).to.equal('Info message');
        });
    });
});
