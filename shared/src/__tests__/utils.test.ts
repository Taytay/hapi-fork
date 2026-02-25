import { describe, expect, it } from 'vitest';
import { asNumber, asString, isObject, safeStringify } from '../utils';

describe('isObject', () => {
    it('returns true for plain objects', () => {
        expect(isObject({})).toBe(true);
        expect(isObject({ a: 1 })).toBe(true);
    });

    it('returns true for arrays (they are objects)', () => {
        expect(isObject([])).toBe(true);
    });

    it('returns false for null', () => {
        expect(isObject(null)).toBe(false);
    });

    it('returns false for undefined', () => {
        expect(isObject(undefined)).toBe(false);
    });

    it('returns false for primitives', () => {
        expect(isObject('')).toBe(false);
        expect(isObject(0)).toBe(false);
        expect(isObject(false)).toBe(false);
    });
});

describe('asString', () => {
    it('returns the string for string values', () => {
        expect(asString('hello')).toBe('hello');
        expect(asString('')).toBe('');
    });

    it('returns null for non-string values', () => {
        expect(asString(42)).toBeNull();
        expect(asString(null)).toBeNull();
        expect(asString(undefined)).toBeNull();
        expect(asString(true)).toBeNull();
        expect(asString({})).toBeNull();
    });
});

describe('asNumber', () => {
    it('returns the number for finite number values', () => {
        expect(asNumber(42)).toBe(42);
        expect(asNumber(0)).toBe(0);
        expect(asNumber(-3.14)).toBe(-3.14);
    });

    it('returns null for NaN', () => {
        expect(asNumber(NaN)).toBeNull();
    });

    it('returns null for Infinity', () => {
        expect(asNumber(Infinity)).toBeNull();
        expect(asNumber(-Infinity)).toBeNull();
    });

    it('returns null for non-number values', () => {
        expect(asNumber('42')).toBeNull();
        expect(asNumber(null)).toBeNull();
        expect(asNumber(undefined)).toBeNull();
    });
});

describe('safeStringify', () => {
    it('returns the string as-is for string input', () => {
        expect(safeStringify('hello')).toBe('hello');
    });

    it('JSON-stringifies objects', () => {
        expect(safeStringify({ a: 1 })).toBe('{\n  "a": 1\n}');
    });

    it('JSON-stringifies arrays', () => {
        expect(safeStringify([1, 2])).toBe('[\n  1,\n  2\n]');
    });

    it('handles circular references gracefully', () => {
        const obj: Record<string, unknown> = {};
        obj.self = obj;
        const result = safeStringify(obj);
        expect(typeof result).toBe('string');
    });

    it('handles null and undefined', () => {
        expect(safeStringify(null)).toBe('null');
        expect(safeStringify(undefined)).toBe('undefined');
    });
});
