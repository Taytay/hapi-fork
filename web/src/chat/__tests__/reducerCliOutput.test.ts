import { describe, it, expect } from 'vitest'
import { isCliOutputText, createCliOutputBlock, mergeCliOutputBlocks } from '@/chat/reducerCliOutput'
import type { ChatBlock, CliOutputBlock } from '@/chat/types'

describe('isCliOutputText', () => {
    it('returns true for text with CLI tags and meta.sentFrom === "cli"', () => {
        expect(isCliOutputText('<command-name>ls</command-name>', { sentFrom: 'cli' })).toBe(true)
        expect(isCliOutputText('<command-message>done</command-message>', { sentFrom: 'cli' })).toBe(true)
        expect(isCliOutputText('<command-args>-la</command-args>', { sentFrom: 'cli' })).toBe(true)
        expect(isCliOutputText('<local-command-stdout>output</local-command-stdout>', { sentFrom: 'cli' })).toBe(true)
    })

    it('returns false when sentFrom is not "cli"', () => {
        expect(isCliOutputText('<command-name>ls</command-name>', { sentFrom: 'web' })).toBe(false)
        expect(isCliOutputText('<command-name>ls</command-name>', {})).toBe(false)
        expect(isCliOutputText('<command-name>ls</command-name>', null)).toBe(false)
        expect(isCliOutputText('<command-name>ls</command-name>', undefined)).toBe(false)
    })

    it('returns false when text has no CLI tags', () => {
        expect(isCliOutputText('just normal text', { sentFrom: 'cli' })).toBe(false)
        expect(isCliOutputText('', { sentFrom: 'cli' })).toBe(false)
    })

    it('is case-insensitive for tags', () => {
        expect(isCliOutputText('<COMMAND-NAME>ls</COMMAND-NAME>', { sentFrom: 'cli' })).toBe(true)
        expect(isCliOutputText('<Command-Name>ls</Command-Name>', { sentFrom: 'cli' })).toBe(true)
    })

    it('handles local-command-* tags', () => {
        expect(isCliOutputText('<local-command-stderr>error</local-command-stderr>', { sentFrom: 'cli' })).toBe(true)
    })
})

describe('createCliOutputBlock', () => {
    it('creates a cli-output block with the given props', () => {
        const block = createCliOutputBlock({
            id: 'b1',
            localId: 'loc1',
            createdAt: 1000,
            text: '<command-name>git status</command-name>',
            source: 'user',
            meta: { sentFrom: 'cli' },
        })
        expect(block.kind).toBe('cli-output')
        expect(block.id).toBe('b1')
        expect(block.localId).toBe('loc1')
        expect(block.createdAt).toBe(1000)
        expect(block.text).toBe('<command-name>git status</command-name>')
        expect(block.source).toBe('user')
        expect(block.meta).toEqual({ sentFrom: 'cli' })
    })

    it('handles null localId and undefined meta', () => {
        const block = createCliOutputBlock({
            id: 'b2',
            localId: null,
            createdAt: 2000,
            text: 'text',
            source: 'assistant',
        })
        expect(block.localId).toBeNull()
        expect(block.meta).toBeUndefined()
    })
})

describe('mergeCliOutputBlocks', () => {
    function makeCliBlock(id: string, text: string, source: 'user' | 'assistant' = 'user'): CliOutputBlock {
        return {
            kind: 'cli-output',
            id,
            localId: null,
            createdAt: 1000,
            text,
            source,
        }
    }

    it('returns blocks unchanged when there are no cli-output blocks', () => {
        const blocks: ChatBlock[] = [
            { kind: 'user-text', id: 'u1', localId: null, createdAt: 1000, text: 'hello' },
            { kind: 'agent-text', id: 'a1', localId: null, createdAt: 1000, text: 'world' },
        ]
        const result = mergeCliOutputBlocks(blocks)
        expect(result).toEqual(blocks)
    })

    it('merges consecutive cli-output blocks when prev has command-name and next has stdout', () => {
        const blocks: ChatBlock[] = [
            makeCliBlock('c1', '<command-name>ls</command-name>'),
            makeCliBlock('c2', '<local-command-stdout>file1\nfile2</local-command-stdout>'),
        ]
        const result = mergeCliOutputBlocks(blocks)
        expect(result).toHaveLength(1)
        expect((result[0] as CliOutputBlock).text).toContain('<command-name>')
        expect((result[0] as CliOutputBlock).text).toContain('<local-command-stdout>')
    })

    it('does not merge when prev already has stdout', () => {
        const blocks: ChatBlock[] = [
            makeCliBlock('c1', '<command-name>ls</command-name>\n<local-command-stdout>old</local-command-stdout>'),
            makeCliBlock('c2', '<local-command-stdout>new</local-command-stdout>'),
        ]
        const result = mergeCliOutputBlocks(blocks)
        expect(result).toHaveLength(2)
    })

    it('does not merge when prev has no command-name tag', () => {
        const blocks: ChatBlock[] = [
            makeCliBlock('c1', '<command-args>-la</command-args>'),
            makeCliBlock('c2', '<local-command-stdout>output</local-command-stdout>'),
        ]
        const result = mergeCliOutputBlocks(blocks)
        expect(result).toHaveLength(2)
    })

    it('does not merge cli-output blocks with different sources', () => {
        const blocks: ChatBlock[] = [
            makeCliBlock('c1', '<command-name>ls</command-name>', 'user'),
            makeCliBlock('c2', '<local-command-stdout>output</local-command-stdout>', 'assistant'),
        ]
        const result = mergeCliOutputBlocks(blocks)
        expect(result).toHaveLength(2)
    })

    it('handles separator between merged text correctly', () => {
        const blocks: ChatBlock[] = [
            makeCliBlock('c1', '<command-name>ls</command-name>'), // no trailing newline
            makeCliBlock('c2', '<local-command-stdout>output</local-command-stdout>'),
        ]
        const result = mergeCliOutputBlocks(blocks)
        const text = (result[0] as CliOutputBlock).text
        expect(text).toBe('<command-name>ls</command-name>\n<local-command-stdout>output</local-command-stdout>')
    })

    it('does not add double newline if prev ends with newline', () => {
        const blocks: ChatBlock[] = [
            makeCliBlock('c1', '<command-name>ls</command-name>\n'),
            makeCliBlock('c2', '<local-command-stdout>out</local-command-stdout>'),
        ]
        const result = mergeCliOutputBlocks(blocks)
        const text = (result[0] as CliOutputBlock).text
        expect(text).toBe('<command-name>ls</command-name>\n<local-command-stdout>out</local-command-stdout>')
        expect(text).not.toContain('\n\n')
    })

    it('passes through non-cli-output blocks untouched', () => {
        const blocks: ChatBlock[] = [
            { kind: 'user-text', id: 'u1', localId: null, createdAt: 1000, text: 'hello' },
            makeCliBlock('c1', '<command-name>ls</command-name>'),
            makeCliBlock('c2', '<local-command-stdout>out</local-command-stdout>'),
            { kind: 'agent-text', id: 'a1', localId: null, createdAt: 1000, text: 'done' },
        ]
        const result = mergeCliOutputBlocks(blocks)
        expect(result).toHaveLength(3) // user, merged-cli, agent
        expect(result[0].kind).toBe('user-text')
        expect(result[1].kind).toBe('cli-output')
        expect(result[2].kind).toBe('agent-text')
    })
})
