import { describe, expect, it } from 'vitest';
import { dedupeAgentEvents, foldApiErrorEvents, parseMessageAsEvent } from '@/chat/reducerEvents';
import type { AgentEventBlock, ChatBlock, NormalizedMessage } from '@/chat/types';

describe('parseMessageAsEvent', () => {
    it('parses Claude usage limit text into limit-reached event', () => {
        const msg: NormalizedMessage = {
            id: 'msg1',
            localId: null,
            createdAt: 1000,
            role: 'agent',
            isSidechain: false,
            content: [
                {
                    type: 'text',
                    text: 'Claude AI usage limit reached|1700000000',
                    uuid: 'u1',
                    parentUUID: null,
                },
            ],
        };
        const event = parseMessageAsEvent(msg);
        expect(event).not.toBeNull();
        expect(event?.type).toBe('limit-reached');
        expect((event as { endsAt: number }).endsAt).toBe(1700000000);
    });

    it('returns null for non-matching agent text', () => {
        const msg: NormalizedMessage = {
            id: 'msg2',
            localId: null,
            createdAt: 1000,
            role: 'agent',
            isSidechain: false,
            content: [{ type: 'text', text: 'Hello world', uuid: 'u1', parentUUID: null }],
        };
        expect(parseMessageAsEvent(msg)).toBeNull();
    });

    it('returns null for sidechain messages', () => {
        const msg: NormalizedMessage = {
            id: 'msg3',
            localId: null,
            createdAt: 1000,
            role: 'agent',
            isSidechain: true,
            content: [
                {
                    type: 'text',
                    text: 'Claude AI usage limit reached|1700000000',
                    uuid: 'u1',
                    parentUUID: null,
                },
            ],
        };
        expect(parseMessageAsEvent(msg)).toBeNull();
    });

    it('returns null for user messages', () => {
        const msg: NormalizedMessage = {
            id: 'msg4',
            localId: null,
            createdAt: 1000,
            role: 'user',
            isSidechain: false,
            content: {
                type: 'text',
                text: 'Claude AI usage limit reached|1700000000',
            },
        };
        expect(parseMessageAsEvent(msg)).toBeNull();
    });
});

describe('dedupeAgentEvents', () => {
    function makeEvent(id: string, event: { type: string; [key: string]: unknown }): AgentEventBlock {
        return {
            kind: 'agent-event',
            id,
            createdAt: 1000,
            event: event as AgentEventBlock['event'],
        };
    }

    it('removes consecutive duplicate title-changed events', () => {
        const blocks: ChatBlock[] = [
            makeEvent('e1', { type: 'title-changed', title: 'My Title' }),
            makeEvent('e2', { type: 'title-changed', title: 'My Title' }),
        ];
        const result = dedupeAgentEvents(blocks);
        expect(result).toHaveLength(1);
    });

    it('keeps different title-changed events', () => {
        const blocks: ChatBlock[] = [
            makeEvent('e1', { type: 'title-changed', title: 'Title A' }),
            makeEvent('e2', { type: 'title-changed', title: 'Title B' }),
        ];
        const result = dedupeAgentEvents(blocks);
        expect(result).toHaveLength(2);
    });

    it('removes consecutive duplicate message events', () => {
        const blocks: ChatBlock[] = [
            makeEvent('e1', { type: 'message', message: 'Processing...' }),
            makeEvent('e2', { type: 'message', message: 'Processing...' }),
        ];
        const result = dedupeAgentEvents(blocks);
        expect(result).toHaveLength(1);
    });

    it('filters message event that matches previous title-changed title', () => {
        const blocks: ChatBlock[] = [
            makeEvent('e1', { type: 'title-changed', title: 'My Title' }),
            makeEvent('e2', { type: 'message', message: 'My Title' }),
        ];
        const result = dedupeAgentEvents(blocks);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('e1');
    });

    it('resets dedup tracking when non-event block appears', () => {
        const blocks: ChatBlock[] = [
            makeEvent('e1', { type: 'message', message: 'hello' }),
            {
                kind: 'agent-text',
                id: 'a1',
                localId: null,
                createdAt: 1000,
                text: 'text',
            },
            makeEvent('e2', { type: 'message', message: 'hello' }),
        ];
        const result = dedupeAgentEvents(blocks);
        expect(result).toHaveLength(3);
    });

    it('passes through non-event blocks unchanged', () => {
        const blocks: ChatBlock[] = [
            {
                kind: 'user-text',
                id: 'u1',
                localId: null,
                createdAt: 1000,
                text: 'hello',
            },
            {
                kind: 'agent-text',
                id: 'a1',
                localId: null,
                createdAt: 1000,
                text: 'world',
            },
        ];
        const result = dedupeAgentEvents(blocks);
        expect(result).toEqual(blocks);
    });
});

describe('foldApiErrorEvents', () => {
    function makeEvent(id: string, event: { type: string; [key: string]: unknown }): AgentEventBlock {
        return {
            kind: 'agent-event',
            id,
            createdAt: 1000,
            event: event as AgentEventBlock['event'],
        };
    }

    it('folds consecutive api-error events keeping only the latest', () => {
        const blocks: ChatBlock[] = [
            makeEvent('e1', {
                type: 'api-error',
                retryAttempt: 1,
                maxRetries: 3,
                error: 'err1',
            }),
            makeEvent('e2', {
                type: 'api-error',
                retryAttempt: 2,
                maxRetries: 3,
                error: 'err2',
            }),
            makeEvent('e3', {
                type: 'api-error',
                retryAttempt: 3,
                maxRetries: 3,
                error: 'err3',
            }),
        ];
        const result = foldApiErrorEvents(blocks);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('e3');
    });

    it('does not fold api-error events separated by other blocks', () => {
        const blocks: ChatBlock[] = [
            makeEvent('e1', {
                type: 'api-error',
                retryAttempt: 1,
                maxRetries: 3,
                error: 'err1',
            }),
            {
                kind: 'agent-text',
                id: 'a1',
                localId: null,
                createdAt: 1000,
                text: 'text',
            },
            makeEvent('e2', {
                type: 'api-error',
                retryAttempt: 2,
                maxRetries: 3,
                error: 'err2',
            }),
        ];
        const result = foldApiErrorEvents(blocks);
        expect(result).toHaveLength(3);
    });

    it('passes through non-api-error event blocks', () => {
        const blocks: ChatBlock[] = [
            makeEvent('e1', { type: 'ready' }),
            makeEvent('e2', { type: 'title-changed', title: 'Test' }),
        ];
        const result = foldApiErrorEvents(blocks);
        expect(result).toHaveLength(2);
    });

    it('handles empty blocks array', () => {
        expect(foldApiErrorEvents([])).toEqual([]);
    });
});
