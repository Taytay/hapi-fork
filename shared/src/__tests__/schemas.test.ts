import { describe, it, expect } from 'vitest'
import {
    SessionSchema,
    MetadataSchema,
    AgentStateSchema,
    AgentStateRequestSchema,
    AgentStateCompletedRequestSchema,
    TodoItemSchema,
    TodosSchema,
    AttachmentMetadataSchema,
    DecryptedMessageSchema,
    SyncEventSchema,
    PermissionModeSchema,
    ModelModeSchema,
    WorktreeMetadataSchema,
} from '../schemas'

describe('PermissionModeSchema', () => {
    it('accepts valid permission modes', () => {
        for (const mode of ['default', 'acceptEdits', 'bypassPermissions', 'plan', 'read-only', 'safe-yolo', 'yolo']) {
            expect(PermissionModeSchema.parse(mode)).toBe(mode)
        }
    })

    it('rejects invalid permission mode', () => {
        expect(() => PermissionModeSchema.parse('invalid')).toThrow()
    })
})

describe('ModelModeSchema', () => {
    it('accepts valid model modes', () => {
        for (const mode of ['default', 'sonnet', 'opus']) {
            expect(ModelModeSchema.parse(mode)).toBe(mode)
        }
    })

    it('rejects invalid model mode', () => {
        expect(() => ModelModeSchema.parse('gpt4')).toThrow()
    })
})

describe('MetadataSchema', () => {
    it('accepts minimal valid metadata', () => {
        const data = { path: '/home/user/project', host: 'my-machine' }
        const result = MetadataSchema.parse(data)
        expect(result.path).toBe('/home/user/project')
        expect(result.host).toBe('my-machine')
    })

    it('accepts full metadata with all optional fields', () => {
        const data = {
            path: '/project',
            host: 'machine',
            version: '1.0.0',
            name: 'My Session',
            os: 'linux',
            summary: { text: 'Working on tests', updatedAt: 1000 },
            machineId: 'machine-1',
            tools: ['Bash', 'Read'],
            flavor: 'claude',
            worktree: {
                basePath: '/project',
                branch: 'feature',
                name: 'my-worktree',
                worktreePath: '/project/.worktrees/my-worktree',
                createdAt: 5000,
            },
        }
        const result = MetadataSchema.parse(data)
        expect(result.name).toBe('My Session')
        expect(result.worktree!.branch).toBe('feature')
    })

    it('rejects metadata without required fields', () => {
        expect(() => MetadataSchema.parse({})).toThrow()
        expect(() => MetadataSchema.parse({ path: '/project' })).toThrow()
    })
})

describe('AgentStateSchema', () => {
    it('accepts empty agent state', () => {
        expect(AgentStateSchema.parse({})).toEqual({})
    })

    it('accepts agent state with requests and completedRequests', () => {
        const data = {
            controlledByUser: true,
            requests: {
                'req-1': { tool: 'Bash', arguments: { command: 'ls' } },
            },
            completedRequests: {
                'req-2': { tool: 'Read', arguments: { file: 'x.ts' }, status: 'approved' },
            },
        }
        const result = AgentStateSchema.parse(data)
        expect(result.controlledByUser).toBe(true)
    })
})

describe('AgentStateRequestSchema', () => {
    it('accepts valid request', () => {
        const data = { tool: 'Bash', arguments: { command: 'ls' }, createdAt: 1000 }
        const result = AgentStateRequestSchema.parse(data)
        expect(result.tool).toBe('Bash')
    })

    it('accepts request with null createdAt', () => {
        const data = { tool: 'Read', arguments: {} }
        expect(AgentStateRequestSchema.parse(data)).toBeDefined()
    })
})

describe('AgentStateCompletedRequestSchema', () => {
    it('accepts approved request', () => {
        const data = {
            tool: 'Bash',
            arguments: { command: 'ls' },
            status: 'approved',
            decision: 'approved',
            mode: 'default',
        }
        const result = AgentStateCompletedRequestSchema.parse(data)
        expect(result.status).toBe('approved')
        expect(result.decision).toBe('approved')
    })

    it('accepts denied request with answers', () => {
        const data = {
            tool: 'AskUserQuestion',
            arguments: {},
            status: 'denied',
            answers: { 'What color?': ['blue', 'green'] },
        }
        const result = AgentStateCompletedRequestSchema.parse(data)
        expect(result.answers).toEqual({ 'What color?': ['blue', 'green'] })
    })

    it('accepts nested answers format', () => {
        const data = {
            tool: 'request_user_input',
            arguments: {},
            status: 'approved',
            answers: { question: { answers: ['yes'] } },
        }
        const result = AgentStateCompletedRequestSchema.parse(data)
        expect(result.answers).toEqual({ question: { answers: ['yes'] } })
    })

    it('rejects invalid status', () => {
        const data = { tool: 'Bash', arguments: {}, status: 'unknown' }
        expect(() => AgentStateCompletedRequestSchema.parse(data)).toThrow()
    })
})

describe('TodoItemSchema', () => {
    it('accepts valid todo item', () => {
        const data = { content: 'Fix bug', status: 'in_progress', priority: 'high', id: 'todo-1' }
        const result = TodoItemSchema.parse(data)
        expect(result.content).toBe('Fix bug')
        expect(result.status).toBe('in_progress')
    })

    it('rejects invalid status', () => {
        expect(() => TodoItemSchema.parse({ content: 'x', status: 'done', priority: 'low', id: '1' })).toThrow()
    })
})

describe('TodosSchema', () => {
    it('accepts array of todo items', () => {
        const data = [
            { content: 'A', status: 'pending', priority: 'low', id: '1' },
            { content: 'B', status: 'completed', priority: 'high', id: '2' },
        ]
        expect(TodosSchema.parse(data)).toHaveLength(2)
    })

    it('accepts empty array', () => {
        expect(TodosSchema.parse([])).toEqual([])
    })
})

describe('AttachmentMetadataSchema', () => {
    it('accepts valid attachment metadata', () => {
        const data = {
            id: 'att-1',
            filename: 'image.png',
            mimeType: 'image/png',
            size: 1024,
            path: '/uploads/image.png',
            previewUrl: 'https://example.com/preview.png',
        }
        const result = AttachmentMetadataSchema.parse(data)
        expect(result.filename).toBe('image.png')
        expect(result.previewUrl).toBe('https://example.com/preview.png')
    })

    it('accepts without optional previewUrl', () => {
        const data = {
            id: 'att-2',
            filename: 'file.txt',
            mimeType: 'text/plain',
            size: 256,
            path: '/uploads/file.txt',
        }
        const result = AttachmentMetadataSchema.parse(data)
        expect(result.previewUrl).toBeUndefined()
    })
})

describe('DecryptedMessageSchema', () => {
    it('accepts valid decrypted message', () => {
        const data = {
            id: 'msg-1',
            seq: 42,
            localId: 'local-1',
            content: { type: 'output', data: {} },
            createdAt: 1000,
        }
        const result = DecryptedMessageSchema.parse(data)
        expect(result.id).toBe('msg-1')
        expect(result.seq).toBe(42)
    })

    it('accepts null seq and localId', () => {
        const data = { id: 'msg-2', seq: null, localId: null, content: 'text', createdAt: 2000 }
        const result = DecryptedMessageSchema.parse(data)
        expect(result.seq).toBeNull()
        expect(result.localId).toBeNull()
    })
})

describe('SessionSchema', () => {
    it('accepts a full valid session', () => {
        const data = {
            id: 'sess-1',
            namespace: 'ns-1',
            seq: 10,
            createdAt: 1000,
            updatedAt: 2000,
            active: true,
            activeAt: 1500,
            metadata: { path: '/project', host: 'machine' },
            metadataVersion: 3,
            agentState: { controlledByUser: false },
            agentStateVersion: 2,
            thinking: false,
            thinkingAt: 0,
            permissionMode: 'default',
            modelMode: 'sonnet',
        }
        const result = SessionSchema.parse(data)
        expect(result.id).toBe('sess-1')
        expect(result.active).toBe(true)
        expect(result.permissionMode).toBe('default')
    })

    it('accepts null metadata and agentState', () => {
        const data = {
            id: 'sess-2',
            namespace: 'ns-1',
            seq: 0,
            createdAt: 1000,
            updatedAt: 1000,
            active: false,
            activeAt: 0,
            metadata: null,
            metadataVersion: 1,
            agentState: null,
            agentStateVersion: 1,
            thinking: false,
            thinkingAt: 0,
        }
        const result = SessionSchema.parse(data)
        expect(result.metadata).toBeNull()
        expect(result.agentState).toBeNull()
    })
})

describe('SyncEventSchema', () => {
    it('accepts session-added event', () => {
        const data = { type: 'session-added', sessionId: 'sess-1', namespace: 'ns-1' }
        const result = SyncEventSchema.parse(data)
        expect(result.type).toBe('session-added')
    })

    it('accepts session-updated event', () => {
        const data = { type: 'session-updated', sessionId: 'sess-1' }
        expect(SyncEventSchema.parse(data).type).toBe('session-updated')
    })

    it('accepts session-removed event', () => {
        const data = { type: 'session-removed', sessionId: 'sess-1' }
        expect(SyncEventSchema.parse(data).type).toBe('session-removed')
    })

    it('accepts message-received event', () => {
        const data = {
            type: 'message-received',
            sessionId: 'sess-1',
            message: { id: 'msg-1', seq: 1, localId: null, content: {}, createdAt: 1000 },
        }
        expect(SyncEventSchema.parse(data).type).toBe('message-received')
    })

    it('accepts machine-updated event', () => {
        const data = { type: 'machine-updated', machineId: 'mac-1' }
        expect(SyncEventSchema.parse(data).type).toBe('machine-updated')
    })

    it('accepts toast event', () => {
        const data = {
            type: 'toast',
            data: { title: 'Hello', body: 'World', sessionId: 'sess-1', url: '/sessions/sess-1' },
        }
        expect(SyncEventSchema.parse(data).type).toBe('toast')
    })

    it('accepts connection-changed event', () => {
        const data = { type: 'connection-changed' }
        expect(SyncEventSchema.parse(data).type).toBe('connection-changed')
    })

    it('rejects unknown event type', () => {
        expect(() => SyncEventSchema.parse({ type: 'unknown' })).toThrow()
    })
})

describe('WorktreeMetadataSchema', () => {
    it('accepts valid worktree metadata', () => {
        const data = { basePath: '/project', branch: 'feature', name: 'wt-1' }
        const result = WorktreeMetadataSchema.parse(data)
        expect(result.branch).toBe('feature')
    })

    it('accepts optional fields', () => {
        const data = {
            basePath: '/project',
            branch: 'main',
            name: 'wt-2',
            worktreePath: '/project/.worktrees/wt-2',
            createdAt: 1000,
        }
        const result = WorktreeMetadataSchema.parse(data)
        expect(result.worktreePath).toBe('/project/.worktrees/wt-2')
    })
})
