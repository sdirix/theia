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
    CHAT_DATA_VERSION,
    SerializedChatData
} from './chat-model-serialization';

describe('Chat Model Serialization', () => {

    describe('JSON round-trip serialization', () => {
        it('should serialize a session with requests containing changeset elements', () => {
            const chatData: SerializedChatData = {
                version: CHAT_DATA_VERSION,
                pinnedAgentId: 'coder',
                saveDate: Date.now(),
                model: {
                    sessionId: 'session-123',
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
                            text: 'Fix the authentication bug',
                            agentId: 'coder',
                            changeSet: {
                                title: 'Auth fixes',
                                elements: [
                                    {
                                        uri: 'file:///src/auth.ts',
                                        name: 'auth.ts',
                                        icon: 'file-code',
                                        additionalInfo: 'Modified authentication logic',
                                        state: 'applied',
                                        type: 'modify',
                                        data: { linesChanged: 15 }
                                    },
                                    {
                                        uri: 'file:///src/auth.test.ts',
                                        name: 'auth.test.ts',
                                        state: 'pending',
                                        type: 'add'
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
                            content: [
                                {
                                    kind: 'text',
                                    fallbackMessage: 'Fixed authentication',
                                    data: { content: 'Fixed authentication' }
                                }
                            ]
                        }
                    ]
                }
            };

            // Verify structure
            expect(chatData.model.requests).to.have.lengthOf(1);
            expect(chatData.model.requests[0].changeSet).to.be.an('object');
            expect(chatData.model.requests[0].changeSet!.elements).to.have.lengthOf(2);

            // Verify first changeset element
            const elem1 = chatData.model.requests[0].changeSet!.elements[0];
            expect(elem1.uri).to.equal('file:///src/auth.ts');
            expect(elem1.state).to.equal('applied');
            expect(elem1.type).to.equal('modify');

            // Verify second changeset element
            const elem2 = chatData.model.requests[0].changeSet!.elements[1];
            expect(elem2.uri).to.equal('file:///src/auth.test.ts');
            expect(elem2.state).to.equal('pending');
            expect(elem2.type).to.equal('add');

            // Verify it can be serialized to JSON and back
            const json = JSON.stringify(chatData);
            const parsed: SerializedChatData = JSON.parse(json);
            expect(parsed.model.requests[0].changeSet!.elements).to.have.lengthOf(2);
            expect(parsed.model.requests[0].changeSet!.elements[0].uri).to.equal('file:///src/auth.ts');
        });

        it('should handle multiple requests with and without changesets', () => {
            const chatData: SerializedChatData = {
                version: CHAT_DATA_VERSION,
                saveDate: Date.now(),
                model: {
                    sessionId: 'session-multi',
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
                            text: 'What is TypeScript?',
                            agentId: 'general',
                            // No changeSet
                        },
                        {
                            id: 'request-2',
                            text: 'Create a new component',
                            agentId: 'coder',
                            changeSet: {
                                title: 'New component',
                                elements: [
                                    {
                                        uri: 'file:///src/components/NewComponent.tsx',
                                        name: 'NewComponent.tsx',
                                        state: 'applied',
                                        type: 'add'
                                    }
                                ]
                            }
                        }
                    ],
                    responses: []
                }
            };

            expect(chatData.model.requests).to.have.lengthOf(2);
            expect(chatData.model.requests[0].changeSet).to.be.undefined;
            expect(chatData.model.requests[1].changeSet).to.be.an('object');
            expect(chatData.model.requests[1].changeSet!.elements).to.have.lengthOf(1);
        });
    });

    describe('Hierarchy JSON round-trip', () => {
        it('should serialize and deserialize hierarchy in chat model', () => {
            const chatData: SerializedChatData = {
                version: CHAT_DATA_VERSION,
                saveDate: Date.now(),
                model: {
                    sessionId: 'session-1',
                    location: ChatAgentLocation.Panel,
                    hierarchy: {
                        rootBranchId: 'branch-1',
                        branches: {
                            'branch-1': {
                                id: 'branch-1',
                                items: [{ requestId: 'request-1' }],
                                activeBranchIndex: 0
                            }
                        }
                    },
                    requests: [
                        {
                            id: 'request-1',
                            text: 'Hello',
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

            // Verify it can be serialized to JSON and back
            const json = JSON.stringify(chatData);
            const parsed: SerializedChatData = JSON.parse(json);

            expect(parsed.model.hierarchy).to.be.an('object');
            expect(parsed.model.hierarchy!.rootBranchId).to.equal('branch-1');
            expect(parsed.model.hierarchy!.branches).to.have.property('branch-1');
        });

        it('should serialize tree with alternatives through JSON', () => {
            const chatData: SerializedChatData = {
                version: CHAT_DATA_VERSION,
                saveDate: Date.now(),
                model: {
                    sessionId: 'session-tree',
                    location: ChatAgentLocation.Panel,
                    hierarchy: {
                        rootBranchId: 'branch-root',
                        branches: {
                            'branch-root': {
                                id: 'branch-root',
                                items: [
                                    { requestId: 'request-1', nextBranchId: 'branch-1' },
                                    { requestId: 'request-1-edited', nextBranchId: 'branch-2' }
                                ],
                                activeBranchIndex: 1
                            },
                            'branch-1': {
                                id: 'branch-1',
                                items: [{ requestId: 'request-2' }],
                                activeBranchIndex: 0
                            },
                            'branch-2': {
                                id: 'branch-2',
                                items: [
                                    { requestId: 'request-3' },
                                    { requestId: 'request-3-edited' }
                                ],
                                activeBranchIndex: 1
                            }
                        }
                    },
                    requests: [
                        { id: 'request-1', text: 'Original' },
                        { id: 'request-1-edited', text: 'Edited' },
                        { id: 'request-2', text: 'Response to original' },
                        { id: 'request-3', text: 'Response to edited' },
                        { id: 'request-3-edited', text: 'Edited again' }
                    ],
                    responses: []
                }
            };

            // Serialize and deserialize through JSON
            const json = JSON.stringify(chatData);
            const parsed: SerializedChatData = JSON.parse(json);

            // Verify structure is preserved
            expect(parsed.model.hierarchy).to.be.an('object');
            expect(parsed.model.hierarchy!.rootBranchId).to.equal('branch-root');
            expect(Object.keys(parsed.model.hierarchy!.branches)).to.have.lengthOf(3);
            expect(parsed.model.requests).to.have.lengthOf(5);

            // Verify root branch has 2 alternatives
            const rootBranch = parsed.model.hierarchy!.branches['branch-root'];
            expect(rootBranch.items).to.have.lengthOf(2);
            expect(rootBranch.activeBranchIndex).to.equal(1);

            // Verify the edited alternative is active and leads to branch-2
            expect(rootBranch.items[1].requestId).to.equal('request-1-edited');
            expect(rootBranch.items[1].nextBranchId).to.equal('branch-2');

            // Verify branch-2 also has alternatives
            const branch2 = parsed.model.hierarchy!.branches['branch-2'];
            expect(branch2.items).to.have.lengthOf(2);
            expect(branch2.activeBranchIndex).to.equal(1);
        });
    });

});
