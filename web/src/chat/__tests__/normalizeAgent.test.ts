import { describe, expect, it } from 'vitest';
import { isCodexContent, isSkippableAgentContent, normalizeAgentRecord } from '@/chat/normalizeAgent';

describe('normalizeAgentRecord', () => {
    describe('assistant output', () => {
        it('normalizes a simple text assistant message', () => {
            const content = {
                type: 'output',
                data: {
                    type: 'assistant',
                    uuid: 'uuid-1',
                    turnId: 'turn-1',
                    message: {
                        content: 'Hello world',
                    },
                },
            };
            const result = normalizeAgentRecord('msg1', 'local1', 1000, content);
            expect(result).not.toBeNull();
            expect(result?.role).toBe('agent');
            expect(result?.content).toHaveLength(1);
            const block = (result?.content as unknown[])[0] as {
                type: string;
                text: string;
            };
            expect(block.type).toBe('text');
            expect(block.text).toBe('Hello world');
        });

        it('normalizes assistant message with array content (text + thinking + tool_use)', () => {
            const content = {
                type: 'output',
                data: {
                    type: 'assistant',
                    uuid: 'uuid-2',
                    message: {
                        content: [
                            { type: 'text', text: 'Some text' },
                            { type: 'thinking', thinking: 'I am thinking...' },
                            {
                                type: 'tool_use',
                                id: 'tool-1',
                                name: 'Read',
                                input: { file: 'test.ts' },
                            },
                        ],
                        usage: {
                            input_tokens: 100,
                            output_tokens: 50,
                            cache_creation_input_tokens: 10,
                        },
                    },
                },
            };
            const result = normalizeAgentRecord('msg2', null, 2000, content);
            expect(result).not.toBeNull();
            expect(result?.role).toBe('agent');
            const blocks = result?.content as unknown[];
            expect(blocks).toHaveLength(3);
            expect((blocks[0] as { type: string }).type).toBe('text');
            expect((blocks[1] as { type: string }).type).toBe('reasoning');
            expect((blocks[2] as { type: string }).type).toBe('tool-call');
            expect(result?.usage).toEqual({
                input_tokens: 100,
                output_tokens: 50,
                cache_creation_input_tokens: 10,
                cache_read_input_tokens: undefined,
                service_tier: undefined,
            });
        });

        it('returns null for missing message field', () => {
            const content = {
                type: 'output',
                data: { type: 'assistant', uuid: 'x' },
            };
            const result = normalizeAgentRecord('msg', null, 1000, content);
            expect(result).toBeNull();
        });

        it('extracts tool description from input.description', () => {
            const content = {
                type: 'output',
                data: {
                    type: 'assistant',
                    uuid: 'u1',
                    message: {
                        content: [
                            {
                                type: 'tool_use',
                                id: 'tool-2',
                                name: 'Write',
                                input: {
                                    description: 'Write a file',
                                    file: 'out.ts',
                                    content: '...',
                                },
                            },
                        ],
                    },
                },
            };
            const result = normalizeAgentRecord('msg3', null, 3000, content);
            const block = (result?.content as unknown[])[0] as {
                description: string | null;
            };
            expect(block.description).toBe('Write a file');
        });

        it('preserves isSidechain', () => {
            const content = {
                type: 'output',
                data: {
                    type: 'assistant',
                    uuid: 'u1',
                    isSidechain: true,
                    message: { content: 'sc text' },
                },
            };
            const result = normalizeAgentRecord('msg4', null, 4000, content);
            expect(result?.isSidechain).toBe(true);
        });
    });

    describe('user output', () => {
        it('normalizes a simple user text message', () => {
            const content = {
                type: 'output',
                data: {
                    type: 'user',
                    uuid: 'uuid-user',
                    message: { content: 'user says hi' },
                },
            };
            const result = normalizeAgentRecord('umsg1', 'loc1', 1000, content);
            expect(result).not.toBeNull();
            expect(result?.role).toBe('user');
            const c = result?.content as { type: string; text: string };
            expect(c.text).toBe('user says hi');
        });

        it('normalizes a sidechain user message as agent sidechain prompt', () => {
            const content = {
                type: 'output',
                data: {
                    type: 'user',
                    uuid: 'uuid-sc',
                    isSidechain: true,
                    message: { content: 'sidechain prompt text' },
                },
            };
            const result = normalizeAgentRecord('umsg2', null, 2000, content);
            expect(result).not.toBeNull();
            expect(result?.role).toBe('agent');
            expect(result?.isSidechain).toBe(true);
            const blocks = result?.content as unknown[];
            expect(blocks).toHaveLength(1);
            expect((blocks[0] as { type: string }).type).toBe('sidechain');
        });

        it('normalizes user message with tool_result array content', () => {
            const content = {
                type: 'output',
                data: {
                    type: 'user',
                    uuid: 'u1',
                    message: {
                        content: [
                            {
                                type: 'tool_result',
                                tool_use_id: 'tool-1',
                                content: 'result text',
                                is_error: false,
                            },
                        ],
                    },
                },
            };
            const result = normalizeAgentRecord('umsg3', null, 3000, content);
            expect(result).not.toBeNull();
            const blocks = result?.content as unknown[];
            expect(blocks).toHaveLength(1);
            expect((blocks[0] as { type: string }).type).toBe('tool-result');
        });
    });

    describe('summary output', () => {
        it('normalizes a summary message', () => {
            const content = {
                type: 'output',
                data: {
                    type: 'summary',
                    summary: 'Session was about debugging.',
                },
            };
            const result = normalizeAgentRecord('smsg', null, 5000, content);
            expect(result).not.toBeNull();
            expect(result?.role).toBe('agent');
            const blocks = result?.content as unknown[];
            expect(blocks).toHaveLength(1);
            expect((blocks[0] as { type: string; summary: string }).summary).toBe('Session was about debugging.');
        });
    });

    describe('system events', () => {
        it('normalizes api_error event', () => {
            const content = {
                type: 'output',
                data: {
                    type: 'system',
                    subtype: 'api_error',
                    retryAttempt: 2,
                    maxRetries: 5,
                    error: 'rate limited',
                },
            };
            const result = normalizeAgentRecord('emsg', null, 6000, content);
            expect(result).not.toBeNull();
            expect(result?.role).toBe('event');
            const event = result?.content as {
                type: string;
                retryAttempt: number;
                maxRetries: number;
            };
            expect(event.type).toBe('api-error');
            expect(event.retryAttempt).toBe(2);
            expect(event.maxRetries).toBe(5);
        });

        it('normalizes turn_duration event', () => {
            const content = {
                type: 'output',
                data: {
                    type: 'system',
                    subtype: 'turn_duration',
                    durationMs: 12345,
                },
            };
            const result = normalizeAgentRecord('tdmsg', null, 7000, content);
            expect(result).not.toBeNull();
            expect(result?.role).toBe('event');
            const event = result?.content as { type: string; durationMs: number };
            expect(event.type).toBe('turn-duration');
            expect(event.durationMs).toBe(12345);
        });

        it('normalizes microcompact_boundary event', () => {
            const content = {
                type: 'output',
                data: {
                    type: 'system',
                    subtype: 'microcompact_boundary',
                    microcompactMetadata: {
                        trigger: 'auto',
                        preTokens: 5000,
                        tokensSaved: 1000,
                    },
                },
            };
            const result = normalizeAgentRecord('mcmsg', null, 8000, content);
            expect(result).not.toBeNull();
            const event = result?.content as {
                type: string;
                trigger: string;
                preTokens: number;
                tokensSaved: number;
            };
            expect(event.type).toBe('microcompact');
            expect(event.tokensSaved).toBe(1000);
        });

        it('normalizes compact_boundary event', () => {
            const content = {
                type: 'output',
                data: {
                    type: 'system',
                    subtype: 'compact_boundary',
                    compactMetadata: {
                        trigger: 'manual',
                        preTokens: 10000,
                    },
                },
            };
            const result = normalizeAgentRecord('cmsg', null, 9000, content);
            expect(result).not.toBeNull();
            const event = result?.content as {
                type: string;
                trigger: string;
                preTokens: number;
            };
            expect(event.type).toBe('compact');
            expect(event.trigger).toBe('manual');
        });
    });

    describe('event type', () => {
        it('normalizes an event-type record', () => {
            const content = {
                type: 'event',
                data: { type: 'ready' },
            };
            const result = normalizeAgentRecord('evmsg', null, 10000, content);
            expect(result).not.toBeNull();
            expect(result?.role).toBe('event');
            expect((result?.content as { type: string }).type).toBe('ready');
        });

        it('returns null for event with invalid data', () => {
            const content = { type: 'event', data: 'not an object' };
            const result = normalizeAgentRecord('evmsg2', null, 10000, content);
            expect(result).toBeNull();
        });
    });

    describe('codex content', () => {
        it('normalizes codex message content', () => {
            const content = {
                type: 'codex',
                data: { type: 'message', message: 'Hello from codex' },
            };
            const result = normalizeAgentRecord('cxmsg', null, 11000, content);
            expect(result).not.toBeNull();
            expect(result?.role).toBe('agent');
            const blocks = result?.content as unknown[];
            expect((blocks[0] as { type: string; text: string }).text).toBe('Hello from codex');
        });

        it('normalizes codex reasoning content', () => {
            const content = {
                type: 'codex',
                data: { type: 'reasoning', message: 'Reasoning text' },
            };
            const result = normalizeAgentRecord('cxr', null, 12000, content);
            const blocks = result?.content as unknown[];
            expect((blocks[0] as { type: string }).type).toBe('reasoning');
        });

        it('normalizes codex tool-call', () => {
            const content = {
                type: 'codex',
                data: {
                    type: 'tool-call',
                    callId: 'call-1',
                    name: 'Bash',
                    input: { command: 'ls' },
                },
            };
            const result = normalizeAgentRecord('cxt', null, 13000, content);
            const blocks = result?.content as unknown[];
            expect((blocks[0] as { type: string; id: string }).type).toBe('tool-call');
            expect((blocks[0] as { id: string }).id).toBe('call-1');
        });

        it('normalizes codex tool-call-result', () => {
            const content = {
                type: 'codex',
                data: {
                    type: 'tool-call-result',
                    callId: 'call-1',
                    output: 'file1\nfile2',
                },
            };
            const result = normalizeAgentRecord('cxtr', null, 14000, content);
            const blocks = result?.content as unknown[];
            expect((blocks[0] as { type: string }).type).toBe('tool-result');
        });
    });

    describe('edge cases', () => {
        it('returns null for non-object content', () => {
            expect(normalizeAgentRecord('x', null, 1000, 'string')).toBeNull();
            expect(normalizeAgentRecord('x', null, 1000, null)).toBeNull();
            expect(normalizeAgentRecord('x', null, 1000, 42)).toBeNull();
        });

        it('skips meta and compact-summary messages', () => {
            const meta = {
                type: 'output',
                data: { type: 'assistant', isMeta: true, message: { content: '' } },
            };
            expect(normalizeAgentRecord('m', null, 1000, meta)).toBeNull();

            const compact = {
                type: 'output',
                data: {
                    type: 'assistant',
                    isCompactSummary: true,
                    message: { content: '' },
                },
            };
            expect(normalizeAgentRecord('c', null, 1000, compact)).toBeNull();
        });

        it('returns null for unknown output data type', () => {
            const content = {
                type: 'output',
                data: { type: 'unknown-type' },
            };
            expect(normalizeAgentRecord('u', null, 1000, content)).toBeNull();
        });
    });
});

describe('isSkippableAgentContent', () => {
    it('returns true for isMeta output', () => {
        expect(isSkippableAgentContent({ type: 'output', data: { isMeta: true } })).toBe(true);
    });

    it('returns true for isCompactSummary output', () => {
        expect(
            isSkippableAgentContent({
                type: 'output',
                data: { isCompactSummary: true },
            }),
        ).toBe(true);
    });

    it('returns false for normal output', () => {
        expect(isSkippableAgentContent({ type: 'output', data: { type: 'assistant' } })).toBe(false);
    });

    it('returns false for non-output type', () => {
        expect(isSkippableAgentContent({ type: 'event', data: {} })).toBe(false);
    });
});

describe('isCodexContent', () => {
    it('returns true for codex type', () => {
        expect(isCodexContent({ type: 'codex', data: {} })).toBe(true);
    });

    it('returns false for non-codex type', () => {
        expect(isCodexContent({ type: 'output', data: {} })).toBe(false);
    });

    it('returns false for non-object', () => {
        expect(isCodexContent('codex')).toBe(false);
    });
});
