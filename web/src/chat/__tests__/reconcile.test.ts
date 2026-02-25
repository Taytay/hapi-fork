import { describe, expect, it } from 'vitest';
import { type ChatBlocksById, reconcileChatBlocks } from '@/chat/reconcile';
import type {
    AgentEventBlock,
    AgentReasoningBlock,
    AgentTextBlock,
    ChatBlock,
    CliOutputBlock,
    ToolCallBlock,
    UserTextBlock,
} from '@/chat/types';

function makeUserBlock(overrides: Partial<UserTextBlock> = {}): UserTextBlock {
    return {
        kind: 'user-text',
        id: 'u1',
        localId: null,
        createdAt: 1000,
        text: 'hello',
        ...overrides,
    };
}

function makeAgentBlock(overrides: Partial<AgentTextBlock> = {}): AgentTextBlock {
    return {
        kind: 'agent-text',
        id: 'a1',
        localId: null,
        createdAt: 1000,
        text: 'response',
        ...overrides,
    };
}

function makeReasoningBlock(overrides: Partial<AgentReasoningBlock> = {}): AgentReasoningBlock {
    return {
        kind: 'agent-reasoning',
        id: 'r1',
        localId: null,
        createdAt: 1000,
        text: 'thinking...',
        ...overrides,
    };
}

function makeCliOutputBlock(overrides: Partial<CliOutputBlock> = {}): CliOutputBlock {
    return {
        kind: 'cli-output',
        id: 'cli1',
        localId: null,
        createdAt: 1000,
        text: '<command-name>ls</command-name>',
        source: 'user',
        ...overrides,
    };
}

function makeEventBlock(overrides: Partial<AgentEventBlock> = {}): AgentEventBlock {
    return {
        kind: 'agent-event',
        id: 'ev1',
        createdAt: 1000,
        event: { type: 'ready' },
        ...overrides,
    };
}

function makeToolCallBlock(overrides: Partial<ToolCallBlock> = {}): ToolCallBlock {
    return {
        kind: 'tool-call',
        id: 'tc1',
        localId: null,
        createdAt: 1000,
        tool: {
            id: 'tc1',
            name: 'Bash',
            state: 'completed',
            input: { command: 'ls' },
            createdAt: 1000,
            startedAt: 1000,
            completedAt: 1100,
            description: null,
        },
        children: [],
        ...overrides,
    };
}

function makeAgentEventBlock(overrides: Partial<AgentEventBlock> = {}): AgentEventBlock {
    return {
        kind: 'agent-event',
        id: 'ev1',
        createdAt: 1000,
        event: { type: 'message', message: 'thinking' },
        ...overrides,
    };
}

function emptyPrevById(): ChatBlocksById {
    return new Map();
}

function prevByIdFrom(blocks: ChatBlock[]): ChatBlocksById {
    const map: ChatBlocksById = new Map();
    for (const b of blocks) {
        map.set(b.id, b);
        if (b.kind === 'tool-call') {
            for (const child of b.children) {
                map.set(child.id, child);
            }
        }
    }
    return map;
}

describe('reconcileChatBlocks', () => {
    it('returns new blocks when prevById is empty', () => {
        const blocks = [makeUserBlock(), makeAgentBlock()];
        const { blocks: result, byId } = reconcileChatBlocks(blocks, emptyPrevById());
        expect(result).toHaveLength(2);
        expect(byId.size).toBe(2);
    });

    it('preserves identity for unchanged user-text blocks', () => {
        const original = makeUserBlock();
        const prevById = prevByIdFrom([original]);
        const next = makeUserBlock(); // same fields, different object
        const { blocks: result } = reconcileChatBlocks([next], prevById);
        expect(result[0]).toBe(original); // same reference
    });

    it('returns new block when user-text text changes', () => {
        const original = makeUserBlock({ text: 'hello' });
        const prevById = prevByIdFrom([original]);
        const next = makeUserBlock({ text: 'world' });
        const { blocks: result } = reconcileChatBlocks([next], prevById);
        expect(result[0]).not.toBe(original);
        expect((result[0] as UserTextBlock).text).toBe('world');
    });

    it('preserves identity for unchanged agent-text blocks', () => {
        const original = makeAgentBlock();
        const prevById = prevByIdFrom([original]);
        const next = makeAgentBlock();
        const { blocks: result } = reconcileChatBlocks([next], prevById);
        expect(result[0]).toBe(original);
    });

    it('returns new block when agent-text changes', () => {
        const original = makeAgentBlock({ text: 'a' });
        const prevById = prevByIdFrom([original]);
        const next = makeAgentBlock({ text: 'b' });
        const { blocks: result } = reconcileChatBlocks([next], prevById);
        expect(result[0]).not.toBe(original);
    });

    it('preserves identity for unchanged agent-reasoning blocks', () => {
        const original = makeReasoningBlock();
        const prevById = prevByIdFrom([original]);
        const next = makeReasoningBlock();
        const { blocks: result } = reconcileChatBlocks([next], prevById);
        expect(result[0]).toBe(original);
    });

    it('preserves identity for unchanged cli-output blocks', () => {
        const original = makeCliOutputBlock();
        const prevById = prevByIdFrom([original]);
        const next = makeCliOutputBlock();
        const { blocks: result } = reconcileChatBlocks([next], prevById);
        expect(result[0]).toBe(original);
    });

    it('returns new block when cli-output source changes', () => {
        const original = makeCliOutputBlock({ source: 'user' });
        const prevById = prevByIdFrom([original]);
        const next = makeCliOutputBlock({ source: 'assistant' });
        const { blocks: result } = reconcileChatBlocks([next], prevById);
        expect(result[0]).not.toBe(original);
    });

    it('preserves identity for unchanged agent-event blocks', () => {
        const original = makeEventBlock({ event: { type: 'ready' } });
        const prevById = prevByIdFrom([original]);
        const next = makeEventBlock({ event: { type: 'ready' } });
        const { blocks: result } = reconcileChatBlocks([next], prevById);
        expect(result[0]).toBe(original);
    });

    it('returns new block when event type changes', () => {
        const original = makeEventBlock({ event: { type: 'ready' } });
        const prevById = prevByIdFrom([original]);
        const next = makeEventBlock({
            event: { type: 'title-changed', title: 'New Title' },
        });
        const { blocks: result } = reconcileChatBlocks([next], prevById);
        expect(result[0]).not.toBe(original);
    });

    it('preserves identity for unchanged tool-call blocks', () => {
        const input = { command: 'ls' };
        const original = makeToolCallBlock({
            tool: { ...makeToolCallBlock().tool, input },
        });
        const prevById = prevByIdFrom([original]);
        // Next block shares same input reference — areToolCallsEqual uses ===
        const next: ToolCallBlock = {
            ...original,
            tool: { ...original.tool },
            children: [...original.children],
        };
        const { blocks: result } = reconcileChatBlocks([next], prevById);
        expect(result[0]).toBe(original);
    });

    it('returns new block when tool state changes', () => {
        const original = makeToolCallBlock();
        const prevById = prevByIdFrom([original]);
        const next = makeToolCallBlock({
            tool: { ...original.tool, state: 'running' },
        });
        const { blocks: result } = reconcileChatBlocks([next], prevById);
        expect(result[0]).not.toBe(original);
    });

    it('handles tool-call with children reconciliation', () => {
        const child = makeAgentBlock({ id: 'child1', text: 'child text' });
        const original = makeToolCallBlock({ children: [child] });
        const prevById = prevByIdFrom([original]);
        // Create next with same input reference and children that reconcile to same identity
        const nextChild = makeAgentBlock({ id: 'child1', text: 'child text' });
        const next: ToolCallBlock = {
            ...original,
            tool: { ...original.tool },
            children: [nextChild],
        };
        const { blocks: result } = reconcileChatBlocks([next], prevById);
        // Children reconcile to same identity, tool fields match — original preserved
        expect(result[0]).toBe(original);
    });

    it('returns new tool block when children change', () => {
        const child = makeAgentBlock({ id: 'child1', text: 'old' });
        const original = makeToolCallBlock({ children: [child] });
        const prevById = prevByIdFrom([original]);
        const nextChild = makeAgentBlock({ id: 'child1', text: 'new' });
        const next = makeToolCallBlock({ children: [nextChild] });
        const { blocks: result } = reconcileChatBlocks([next], prevById);
        expect(result[0]).not.toBe(original);
    });

    it('does not reconcile blocks with different kinds', () => {
        const original = makeUserBlock({ id: 'x' });
        const prevById = prevByIdFrom([original]);
        const next = makeAgentBlock({ id: 'x', text: 'hello' });
        const { blocks: result } = reconcileChatBlocks([next], prevById);
        expect(result[0]).toBe(next); // new block returned as-is
    });

    it('indexes blocks by id in the returned byId map', () => {
        const blocks: ChatBlock[] = [makeUserBlock({ id: 'u1' }), makeAgentBlock({ id: 'a1' })];
        const { byId } = reconcileChatBlocks(blocks, emptyPrevById());
        expect(byId.get('u1')).toBeDefined();
        expect(byId.get('a1')).toBeDefined();
        expect(byId.get('missing')).toBeUndefined();
    });

    it('indexes tool-call children in byId map', () => {
        const child = makeAgentBlock({ id: 'child1' });
        const toolBlock = makeToolCallBlock({ id: 'tc1', children: [child] });
        const { byId } = reconcileChatBlocks([toolBlock], emptyPrevById());
        expect(byId.get('tc1')).toBeDefined();
        expect(byId.get('child1')).toBeDefined();
    });

    it('preserves identity for unchanged agent-event via reference check', () => {
        const original = makeAgentEventBlock();
        const prevById = prevByIdFrom([original]);
        // Same reference — should be preserved
        const { blocks: result } = reconcileChatBlocks([original], prevById);
        expect(result[0]).toBe(original);
    });

    it('handles tool-call with permission equality', () => {
        const permission = {
            id: 'perm1',
            status: 'approved' as const,
            reason: 'test',
            mode: 'default',
            decision: 'approved' as const,
            date: 1000,
            createdAt: 900,
            completedAt: 1000,
            allowedTools: ['Bash', 'Read'],
            answers: { q1: ['yes'] },
        };
        const original = makeToolCallBlock({
            tool: {
                ...makeToolCallBlock().tool,
                permission,
            },
        });
        const prevById = prevByIdFrom([original]);
        // Next block shares same tool property references (input/result/description use ===)
        const next: ToolCallBlock = {
            ...original,
            tool: {
                ...original.tool,
                permission: {
                    ...permission,
                    allowedTools: ['Bash', 'Read'],
                    answers: { q1: ['yes'] },
                },
            },
            children: [...original.children],
        };
        const { blocks: result } = reconcileChatBlocks([next], prevById);
        expect(result[0]).toBe(original); // permission deep-equal, identity preserved
    });
});
