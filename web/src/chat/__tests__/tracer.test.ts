import { describe, expect, it } from 'vitest';
import { type TracedMessage, traceMessages } from '@/chat/tracer';
import type { NormalizedMessage } from '@/chat/types';

function makeAgentMessage(overrides: Partial<NormalizedMessage & { role: 'agent' }> = {}): NormalizedMessage {
    return {
        id: 'msg1',
        localId: null,
        createdAt: 1000,
        role: 'agent',
        isSidechain: false,
        content: [],
        ...overrides,
    } as NormalizedMessage;
}

function makeUserMessage(overrides: Partial<NormalizedMessage & { role: 'user' }> = {}): NormalizedMessage {
    return {
        id: 'msg-user1',
        localId: null,
        createdAt: 1000,
        role: 'user',
        isSidechain: false,
        content: { type: 'text', text: 'hello' },
        ...overrides,
    } as NormalizedMessage;
}

describe('traceMessages', () => {
    it('returns messages as TracedMessages without sidechainId for non-sidechain messages', () => {
        const messages: NormalizedMessage[] = [
            makeUserMessage({ id: 'u1' }),
            makeAgentMessage({
                id: 'a1',
                content: [{ type: 'text', text: 'hi', uuid: 'uuid1', parentUUID: null }],
            }),
        ];
        const result = traceMessages(messages);
        expect(result).toHaveLength(2);
        expect(result[0].sidechainId).toBeUndefined();
        expect(result[1].sidechainId).toBeUndefined();
    });

    it('assigns sidechainId when a sidechain message matches a Task tool prompt', () => {
        const taskPrompt = 'Do some research';
        const messages: NormalizedMessage[] = [
            // Agent message with a Task tool call
            makeAgentMessage({
                id: 'task-msg',
                content: [
                    {
                        type: 'tool-call',
                        id: 'tool1',
                        name: 'Task',
                        input: { prompt: taskPrompt },
                        description: null,
                        uuid: 'uuid-task',
                        parentUUID: null,
                    },
                ],
            }),
            // Sidechain root message with matching prompt
            makeAgentMessage({
                id: 'sc-root',
                isSidechain: true,
                content: [{ type: 'sidechain', uuid: 'uuid-sc', prompt: taskPrompt }],
            }),
        ];
        const result = traceMessages(messages);
        const scRoot = result.find((m) => m.id === 'sc-root') as TracedMessage;
        expect(scRoot.sidechainId).toBe('task-msg');
    });

    it('propagates sidechainId via parentUUID chain', () => {
        const taskPrompt = 'Do research';
        const messages: NormalizedMessage[] = [
            makeAgentMessage({
                id: 'task-msg',
                content: [
                    {
                        type: 'tool-call',
                        id: 'tool1',
                        name: 'Task',
                        input: { prompt: taskPrompt },
                        description: null,
                        uuid: 'uuid-task',
                        parentUUID: null,
                    },
                ],
            }),
            // Sidechain root
            makeAgentMessage({
                id: 'sc-root',
                isSidechain: true,
                content: [{ type: 'sidechain', uuid: 'uuid-sc-root', prompt: taskPrompt }],
            }),
            // Child of sidechain root
            makeAgentMessage({
                id: 'sc-child',
                isSidechain: true,
                content: [
                    {
                        type: 'text',
                        text: 'found it',
                        uuid: 'uuid-sc-child',
                        parentUUID: 'uuid-sc-root',
                    },
                ],
            }),
        ];
        const result = traceMessages(messages);
        const child = result.find((m) => m.id === 'sc-child') as TracedMessage;
        expect(child.sidechainId).toBe('task-msg');
    });

    it('handles orphan messages — resolves once parent becomes available', () => {
        const taskPrompt = 'investigate';
        const messages: NormalizedMessage[] = [
            makeAgentMessage({
                id: 'task-msg',
                content: [
                    {
                        type: 'tool-call',
                        id: 'tool1',
                        name: 'Task',
                        input: { prompt: taskPrompt },
                        description: null,
                        uuid: 'uuid-task',
                        parentUUID: null,
                    },
                ],
            }),
            // Orphan: references parent that hasn't been assigned a sidechain yet
            makeAgentMessage({
                id: 'orphan',
                isSidechain: true,
                content: [
                    {
                        type: 'text',
                        text: 'orphan text',
                        uuid: 'uuid-orphan',
                        parentUUID: 'uuid-sc-root',
                    },
                ],
            }),
            // Now the sidechain root arrives
            makeAgentMessage({
                id: 'sc-root',
                isSidechain: true,
                content: [{ type: 'sidechain', uuid: 'uuid-sc-root', prompt: taskPrompt }],
            }),
        ];
        const result = traceMessages(messages);
        const orphan = result.find((m) => m.id === 'orphan') as TracedMessage;
        expect(orphan.sidechainId).toBe('task-msg');
    });

    it('returns sidechain messages without sidechainId when no Task prompt matches', () => {
        const messages: NormalizedMessage[] = [
            makeAgentMessage({
                id: 'sc-no-match',
                isSidechain: true,
                content: [{ type: 'sidechain', uuid: 'uuid-x', prompt: 'unmatched prompt' }],
            }),
        ];
        const result = traceMessages(messages);
        expect(result[0].sidechainId).toBeUndefined();
    });

    it('leaves non-agent sidechain messages without parentUUID as unresolved', () => {
        const messages: NormalizedMessage[] = [
            makeAgentMessage({
                id: 'sc-loose',
                isSidechain: true,
                content: [{ type: 'text', text: 'loose', uuid: 'uuid-loose', parentUUID: null }],
            }),
        ];
        const result = traceMessages(messages);
        // No sidechain prompt match, no parent — just returned without sidechainId
        expect(result[0].sidechainId).toBeUndefined();
    });

    it('handles empty messages array', () => {
        const result = traceMessages([]);
        expect(result).toEqual([]);
    });

    it('does not mutate original messages', () => {
        const original = makeUserMessage({ id: 'u1' });
        const origRef = original;
        traceMessages([original]);
        expect(original).toBe(origRef); // original object unchanged
        expect(original).not.toHaveProperty('sidechainId');
    });
});
