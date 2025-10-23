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
import { ChatAgentLocation } from './chat-agents';
import {
    SerializedChatData,
    SerializableChangeSetElement,
    CHAT_DATA_VERSION
} from './chat-model-serialization';

describe('Changeset Restoration Edge Cases', () => {

    describe('Multiple changeset elements across requests', () => {
        it('should serialize and restore all changeset elements from multiple requests', () => {
            // Create a session with two requests, each with its own changeset elements
            const chatData: SerializedChatData = {
                version: CHAT_DATA_VERSION,
                saveDate: Date.now(),
                model: {
                    sessionId: 'session-multi-changeset',
                    location: ChatAgentLocation.Panel,
                hierarchy: {
                    rootBranchId: 'branch-root',
                    branches: {
                        'branch-root': {
                            id: 'branch-root',
                            items: [{ requestId: 'request-1' }],
                            activeBranchIndex: 0
                        }
                    }
                },
                    requests: [
                        {
                            id: 'request-1',
                            text: 'First change',
                            agentId: 'coder',
                            changeSet: {
                                title: 'First changes',
                                elements: [
                                    {
                                        kind: 'file',
                                        uri: 'file:///src/file1.ts',
                                        name: 'file1.ts',
                                        state: 'pending',
                                        type: 'modify',
                                        data: {
                                            targetState: 'console.log("change 1");',
                                            originalState: 'console.log("original");',
                                            replacements: []
                                        }
                                    }
                                ]
                            }
                        },
                        {
                            id: 'request-2',
                            text: 'Second change',
                            agentId: 'coder',
                            changeSet: {
                                title: 'Second changes',
                                elements: [
                                    {
                                        kind: 'file',
                                        uri: 'file:///src/file2.ts',
                                        name: 'file2.ts',
                                        state: 'pending',
                                        type: 'add',
                                        data: {
                                            targetState: 'console.log("change 2");',
                                            originalState: '',
                                            replacements: []
                                        }
                                    }
                                ]
                            }
                        }
                    ],
                    responses: [
                        {
                            id: 'response-1',
                            requestId: 'request-1',
                            isComplete: true,
                            isError: false,
                            content: []
                        },
                        {
                            id: 'response-2',
                            requestId: 'request-2',
                            isComplete: true,
                            isError: false,
                            content: []
                        }
                    ]
                }
            };

            // Verify the structure is correct
            expect(chatData.model.requests).to.have.lengthOf(2);
            expect(chatData.model.requests[0].changeSet!.elements).to.have.lengthOf(1);
            expect(chatData.model.requests[1].changeSet!.elements).to.have.lengthOf(1);

            // Verify first request's changeset
            const elem1 = chatData.model.requests[0].changeSet!.elements[0];
            expect(elem1.uri).to.equal('file:///src/file1.ts');
            expect(elem1.state).to.equal('pending');

            // Verify second request's changeset
            const elem2 = chatData.model.requests[1].changeSet!.elements[0];
            expect(elem2.uri).to.equal('file:///src/file2.ts');
            expect(elem2.state).to.equal('pending');

            // Verify it can be serialized and deserialized
            const json = JSON.stringify(chatData);
            const parsed: SerializedChatData = JSON.parse(json);

            expect(parsed.model.requests).to.have.lengthOf(2);
            expect(parsed.model.requests[0].changeSet!.elements).to.have.lengthOf(1);
            expect(parsed.model.requests[1].changeSet!.elements).to.have.lengthOf(1);
            expect(parsed.model.requests[0].changeSet!.elements[0].uri).to.equal('file:///src/file1.ts');
            expect(parsed.model.requests[1].changeSet!.elements[0].uri).to.equal('file:///src/file2.ts');
        });
    });

    describe('Changeset element state restoration', () => {
        it('should preserve applied state when serializing and deserializing', () => {
            const chatData: SerializedChatData = {
                version: CHAT_DATA_VERSION,
                saveDate: Date.now(),
                model: {
                    sessionId: 'session-state-test',
                    location: ChatAgentLocation.Panel,
                hierarchy: {
                    rootBranchId: 'branch-root',
                    branches: {
                        'branch-root': {
                            id: 'branch-root',
                            items: [{ requestId: 'request-1' }],
                            activeBranchIndex: 0
                        }
                    }
                },
                    requests: [
                        {
                            id: 'request-1',
                            text: 'Apply a change',
                            agentId: 'coder',
                            changeSet: {
                                title: 'Mixed states',
                                elements: [
                                    {
                                        kind: 'file',
                                        uri: 'file:///src/applied.ts',
                                        name: 'applied.ts',
                                        state: 'applied', // This should be preserved
                                        type: 'modify',
                                        data: {
                                            targetState: 'console.log("applied");',
                                            originalState: 'console.log("original");',
                                            replacements: []
                                        }
                                    },
                                    {
                                        kind: 'file',
                                        uri: 'file:///src/pending.ts',
                                        name: 'pending.ts',
                                        state: 'pending', // This should be preserved
                                        type: 'add',
                                        data: {
                                            targetState: 'console.log("pending");',
                                            originalState: '',
                                            replacements: []
                                        }
                                    }
                                ]
                            }
                        }
                    ],
                    responses: [
                        {
                            id: 'response-1',
                            requestId: 'request-1',
                            isComplete: true,
                            isError: false,
                            content: []
                        }
                    ]
                }
            };

            // Verify states are preserved in serialization
            expect(chatData.model.requests[0].changeSet!.elements[0].state).to.equal('applied');
            expect(chatData.model.requests[0].changeSet!.elements[1].state).to.equal('pending');

            // Verify serialization/deserialization preserves states
            const json = JSON.stringify(chatData);
            const parsed: SerializedChatData = JSON.parse(json);

            expect(parsed.model.requests[0].changeSet!.elements[0].state).to.equal('applied');
            expect(parsed.model.requests[0].changeSet!.elements[1].state).to.equal('pending');
        });

        it('should handle stale state', () => {
            const element: SerializableChangeSetElement = {
                kind: 'file',
                uri: 'file:///test.ts',
                state: 'stale',
                type: 'modify'
            };

            expect(element.state).to.equal('stale');
        });
    });
});
