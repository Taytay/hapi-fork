import { describe, expect, it } from 'vitest';
import type { Session } from '../schemas';
import { toSessionSummary } from '../sessionSummary';

function makeSession(overrides: Partial<Session> = {}): Session {
    return {
        id: 'sess-1',
        namespace: 'ns-1',
        seq: 5,
        createdAt: 1000,
        updatedAt: 2000,
        active: true,
        activeAt: 1500,
        metadata: {
            path: '/project',
            host: 'machine',
            name: 'My Session',
            machineId: 'mac-1',
            summary: { text: 'Working on tests', updatedAt: 1800 },
            flavor: 'claude',
        },
        metadataVersion: 3,
        agentState: null,
        agentStateVersion: 1,
        thinking: false,
        thinkingAt: 0,
        ...overrides,
    };
}

describe('toSessionSummary', () => {
    it('converts a session to a summary', () => {
        const session = makeSession();
        const summary = toSessionSummary(session);
        expect(summary.id).toBe('sess-1');
        expect(summary.active).toBe(true);
        expect(summary.thinking).toBe(false);
        expect(summary.activeAt).toBe(1500);
        expect(summary.updatedAt).toBe(2000);
        expect(summary.metadata?.name).toBe('My Session');
        expect(summary.metadata?.path).toBe('/project');
        expect(summary.metadata?.machineId).toBe('mac-1');
        expect(summary.metadata?.summary?.text).toBe('Working on tests');
        expect(summary.metadata?.flavor).toBe('claude');
    });

    it('returns null metadata when session has no metadata', () => {
        const session = makeSession({ metadata: null });
        const summary = toSessionSummary(session);
        expect(summary.metadata).toBeNull();
    });

    it('computes pending requests count from agentState', () => {
        const session = makeSession({
            agentState: {
                requests: {
                    'req-1': { tool: 'Bash', arguments: {} },
                    'req-2': { tool: 'Read', arguments: {} },
                },
            },
        });
        const summary = toSessionSummary(session);
        expect(summary.pendingRequestsCount).toBe(2);
    });

    it('returns 0 pending requests when no agentState', () => {
        const session = makeSession({ agentState: null });
        expect(toSessionSummary(session).pendingRequestsCount).toBe(0);
    });

    it('computes todo progress from todos array', () => {
        const session = makeSession({
            todos: [
                { content: 'A', status: 'completed', priority: 'high', id: '1' },
                { content: 'B', status: 'pending', priority: 'low', id: '2' },
                { content: 'C', status: 'completed', priority: 'medium', id: '3' },
            ],
        });
        const summary = toSessionSummary(session);
        expect(summary.todoProgress).toEqual({ completed: 2, total: 3 });
    });

    it('returns null todoProgress when no todos', () => {
        const session = makeSession({ todos: undefined });
        expect(toSessionSummary(session).todoProgress).toBeNull();
    });

    it('returns null todoProgress when todos is empty', () => {
        const session = makeSession({ todos: [] });
        expect(toSessionSummary(session).todoProgress).toBeNull();
    });

    it('includes modelMode in summary', () => {
        const session = makeSession({ modelMode: 'opus' });
        expect(toSessionSummary(session).modelMode).toBe('opus');
    });
});
