import { describe, expect, it } from 'vitest';
import {
    collectTitleChanges,
    collectToolIdsFromMessages,
    ensureToolBlock,
    extractTitleFromChangeTitleInput,
    getPermissions,
    isChangeTitleToolName,
} from '@/chat/reducerTools';
import type { ChatBlock, NormalizedMessage, ToolCallBlock } from '@/chat/types';

describe('getPermissions', () => {
    it('returns empty map for null agentState', () => {
        expect(getPermissions(null).size).toBe(0);
    });

    it('returns empty map for agentState with no requests or completedRequests', () => {
        expect(getPermissions({}).size).toBe(0);
    });

    it('extracts permissions from completedRequests', () => {
        const agentState = {
            completedRequests: {
                'req-1': {
                    tool: 'Bash',
                    arguments: { command: 'ls' },
                    status: 'approved' as const,
                    reason: 'user approved',
                    mode: 'default',
                    decision: 'approved' as const,
                },
            },
        };
        const map = getPermissions(agentState);
        expect(map.size).toBe(1);
        const entry = map.get('req-1')!;
        expect(entry.toolName).toBe('Bash');
        expect(entry.permission.status).toBe('approved');
        expect(entry.permission.reason).toBe('user approved');
    });

    it('extracts pending permissions from requests', () => {
        const agentState = {
            requests: {
                'req-2': {
                    tool: 'Write',
                    arguments: { file: 'test.ts' },
                    createdAt: 5000,
                },
            },
        };
        const map = getPermissions(agentState);
        expect(map.size).toBe(1);
        const entry = map.get('req-2')!;
        expect(entry.toolName).toBe('Write');
        expect(entry.permission.status).toBe('pending');
        expect(entry.permission.createdAt).toBe(5000);
    });

    it('completedRequests take precedence over requests for same id', () => {
        const agentState = {
            requests: {
                'req-1': { tool: 'Bash', arguments: {} },
            },
            completedRequests: {
                'req-1': { tool: 'Bash', arguments: {}, status: 'denied' as const },
            },
        };
        const map = getPermissions(agentState);
        expect(map.size).toBe(1);
        expect(map.get('req-1')?.permission.status).toBe('denied');
    });
});

describe('ensureToolBlock', () => {
    it('creates a new tool block when none exists', () => {
        const blocks: ChatBlock[] = [];
        const toolBlocksById = new Map<string, ToolCallBlock>();
        const block = ensureToolBlock(blocks, toolBlocksById, 'tool-1', {
            createdAt: 1000,
            localId: null,
            name: 'Bash',
            input: { command: 'ls' },
            description: 'Run ls',
        });
        expect(block.kind).toBe('tool-call');
        expect(block.tool.name).toBe('Bash');
        expect(block.tool.state).toBe('running');
        expect(blocks).toHaveLength(1);
        expect(toolBlocksById.size).toBe(1);
    });

    it('returns existing tool block if already created', () => {
        const blocks: ChatBlock[] = [];
        const toolBlocksById = new Map<string, ToolCallBlock>();
        const first = ensureToolBlock(blocks, toolBlocksById, 'tool-1', {
            createdAt: 1000,
            localId: null,
            name: 'Bash',
            input: { command: 'ls' },
            description: null,
        });
        const second = ensureToolBlock(blocks, toolBlocksById, 'tool-1', {
            createdAt: 2000,
            localId: null,
            name: 'Bash',
            input: { command: 'pwd' },
            description: 'Run pwd',
        });
        expect(second).toBe(first);
        expect(blocks).toHaveLength(1); // not duplicated
    });

    it('uses earlier createdAt when existing block has later time', () => {
        const blocks: ChatBlock[] = [];
        const toolBlocksById = new Map<string, ToolCallBlock>();
        ensureToolBlock(blocks, toolBlocksById, 'tool-1', {
            createdAt: 2000,
            localId: null,
            name: 'Bash',
            input: null,
            description: null,
        });
        const block = ensureToolBlock(blocks, toolBlocksById, 'tool-1', {
            createdAt: 1000,
            localId: null,
            name: 'Bash',
            input: null,
            description: null,
        });
        expect(block.createdAt).toBe(1000);
    });

    it('upgrades placeholder tool name with real name', () => {
        const blocks: ChatBlock[] = [];
        const toolBlocksById = new Map<string, ToolCallBlock>();
        ensureToolBlock(blocks, toolBlocksById, 'tool-1', {
            createdAt: 1000,
            localId: null,
            name: 'Tool',
            input: null,
            description: null,
        });
        ensureToolBlock(blocks, toolBlocksById, 'tool-1', {
            createdAt: 1000,
            localId: null,
            name: 'Read',
            input: null,
            description: null,
        });
        expect(toolBlocksById.get('tool-1')?.tool.name).toBe('Read');
    });

    it('sets state to pending for pending permission', () => {
        const blocks: ChatBlock[] = [];
        const toolBlocksById = new Map<string, ToolCallBlock>();
        const block = ensureToolBlock(blocks, toolBlocksById, 'tool-1', {
            createdAt: 1000,
            localId: null,
            name: 'Bash',
            input: null,
            description: null,
            permission: { id: 'tool-1', status: 'pending' },
        });
        expect(block.tool.state).toBe('pending');
    });

    it('sets state to error for denied permission', () => {
        const blocks: ChatBlock[] = [];
        const toolBlocksById = new Map<string, ToolCallBlock>();
        const block = ensureToolBlock(blocks, toolBlocksById, 'tool-1', {
            createdAt: 1000,
            localId: null,
            name: 'Bash',
            input: null,
            description: null,
            permission: { id: 'tool-1', status: 'denied' },
        });
        expect(block.tool.state).toBe('error');
    });
});

describe('collectToolIdsFromMessages', () => {
    it('collects tool-call and tool-result ids from agent messages', () => {
        const messages: NormalizedMessage[] = [
            {
                id: 'msg1',
                localId: null,
                createdAt: 1000,
                role: 'agent',
                isSidechain: false,
                content: [
                    {
                        type: 'tool-call',
                        id: 'tc1',
                        name: 'Bash',
                        input: {},
                        description: null,
                        uuid: 'u1',
                        parentUUID: null,
                    },
                    {
                        type: 'tool-result',
                        tool_use_id: 'tc2',
                        content: 'ok',
                        is_error: false,
                        uuid: 'u2',
                        parentUUID: null,
                    },
                ],
            },
        ];
        const ids = collectToolIdsFromMessages(messages);
        expect(ids.has('tc1')).toBe(true);
        expect(ids.has('tc2')).toBe(true);
    });

    it('skips non-agent messages', () => {
        const messages: NormalizedMessage[] = [
            {
                id: 'u1',
                localId: null,
                createdAt: 1000,
                role: 'user',
                isSidechain: false,
                content: { type: 'text', text: 'hello' },
            },
        ];
        const ids = collectToolIdsFromMessages(messages);
        expect(ids.size).toBe(0);
    });
});

describe('isChangeTitleToolName', () => {
    it('returns true for known title-change tool names', () => {
        expect(isChangeTitleToolName('mcp__hapi__change_title')).toBe(true);
        expect(isChangeTitleToolName('hapi__change_title')).toBe(true);
    });

    it('returns false for other tool names', () => {
        expect(isChangeTitleToolName('Bash')).toBe(false);
        expect(isChangeTitleToolName('change_title')).toBe(false);
    });
});

describe('extractTitleFromChangeTitleInput', () => {
    it('extracts title from input object', () => {
        expect(extractTitleFromChangeTitleInput({ title: 'My New Title' })).toBe('My New Title');
    });

    it('trims whitespace', () => {
        expect(extractTitleFromChangeTitleInput({ title: '  Trimmed  ' })).toBe('Trimmed');
    });

    it('returns null for empty or blank title', () => {
        expect(extractTitleFromChangeTitleInput({ title: '   ' })).toBeNull();
        expect(extractTitleFromChangeTitleInput({ title: '' })).toBeNull();
    });

    it('returns null for non-string title', () => {
        expect(extractTitleFromChangeTitleInput({ title: 42 })).toBeNull();
        expect(extractTitleFromChangeTitleInput({})).toBeNull();
    });

    it('returns null for non-object input', () => {
        expect(extractTitleFromChangeTitleInput(null)).toBeNull();
        expect(extractTitleFromChangeTitleInput('string')).toBeNull();
    });
});

describe('collectTitleChanges', () => {
    it('collects title changes from agent messages with title tool calls', () => {
        const messages: NormalizedMessage[] = [
            {
                id: 'msg1',
                localId: null,
                createdAt: 1000,
                role: 'agent',
                isSidechain: false,
                content: [
                    {
                        type: 'tool-call',
                        id: 'tc1',
                        name: 'mcp__hapi__change_title',
                        input: { title: 'New Title' },
                        description: null,
                        uuid: 'u1',
                        parentUUID: null,
                    },
                ],
            },
        ];
        const map = collectTitleChanges(messages);
        expect(map.get('tc1')).toBe('New Title');
    });

    it('ignores non-title tool calls', () => {
        const messages: NormalizedMessage[] = [
            {
                id: 'msg1',
                localId: null,
                createdAt: 1000,
                role: 'agent',
                isSidechain: false,
                content: [
                    {
                        type: 'tool-call',
                        id: 'tc1',
                        name: 'Bash',
                        input: { command: 'ls' },
                        description: null,
                        uuid: 'u1',
                        parentUUID: null,
                    },
                ],
            },
        ];
        const map = collectTitleChanges(messages);
        expect(map.size).toBe(0);
    });
});
