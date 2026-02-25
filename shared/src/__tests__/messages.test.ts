import { describe, it, expect } from 'vitest'
import { isRoleWrappedRecord, unwrapRoleWrappedRecordEnvelope } from '../messages'

describe('isRoleWrappedRecord', () => {
    it('returns true for objects with role string and content property', () => {
        expect(isRoleWrappedRecord({ role: 'user', content: 'hello' })).toBe(true)
        expect(isRoleWrappedRecord({ role: 'assistant', content: [] })).toBe(true)
        expect(isRoleWrappedRecord({ role: 'system', content: null })).toBe(true)
    })

    it('returns false for objects missing role or content', () => {
        expect(isRoleWrappedRecord({ content: 'hello' })).toBe(false)
        expect(isRoleWrappedRecord({ role: 'user' })).toBe(false)
        expect(isRoleWrappedRecord({})).toBe(false)
    })

    it('returns false for non-object values', () => {
        expect(isRoleWrappedRecord(null)).toBe(false)
        expect(isRoleWrappedRecord(undefined)).toBe(false)
        expect(isRoleWrappedRecord('string')).toBe(false)
        expect(isRoleWrappedRecord(42)).toBe(false)
    })

    it('returns false when role is not a string', () => {
        expect(isRoleWrappedRecord({ role: 42, content: 'x' })).toBe(false)
    })
})

describe('unwrapRoleWrappedRecordEnvelope', () => {
    it('returns the record directly if it is role-wrapped', () => {
        const record = { role: 'user', content: 'hello' }
        expect(unwrapRoleWrappedRecordEnvelope(record)).toBe(record)
    })

    it('unwraps from { message: ... } envelope', () => {
        const inner = { role: 'assistant', content: 'response' }
        const result = unwrapRoleWrappedRecordEnvelope({ message: inner })
        expect(result).toBe(inner)
    })

    it('unwraps from { data: { message: ... } } envelope', () => {
        const inner = { role: 'user', content: 'nested' }
        const result = unwrapRoleWrappedRecordEnvelope({ data: { message: inner } })
        expect(result).toBe(inner)
    })

    it('unwraps from { payload: { message: ... } } envelope', () => {
        const inner = { role: 'system', content: 'deep' }
        const result = unwrapRoleWrappedRecordEnvelope({ payload: { message: inner } })
        expect(result).toBe(inner)
    })

    it('returns null for non-object input', () => {
        expect(unwrapRoleWrappedRecordEnvelope(null)).toBeNull()
        expect(unwrapRoleWrappedRecordEnvelope(undefined)).toBeNull()
        expect(unwrapRoleWrappedRecordEnvelope('string')).toBeNull()
        expect(unwrapRoleWrappedRecordEnvelope(42)).toBeNull()
    })

    it('returns null when no envelope matches', () => {
        expect(unwrapRoleWrappedRecordEnvelope({ foo: 'bar' })).toBeNull()
        expect(unwrapRoleWrappedRecordEnvelope({ message: 'not-a-record' })).toBeNull()
    })
})
