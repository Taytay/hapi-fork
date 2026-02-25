import { describe, it, expect } from 'vitest'
import {
    getPermissionModeLabel,
    getPermissionModeTone,
    getPermissionModesForFlavor,
    getPermissionModeOptionsForFlavor,
    isPermissionModeAllowedForFlavor,
    getModelModesForFlavor,
    isModelModeAllowedForFlavor,
    CLAUDE_PERMISSION_MODES,
    CODEX_PERMISSION_MODES,
    GEMINI_PERMISSION_MODES,
    OPENCODE_PERMISSION_MODES,
    PERMISSION_MODES,
    MODEL_MODES,
} from '../modes'

describe('getPermissionModeLabel', () => {
    it('returns labels for all permission modes', () => {
        expect(getPermissionModeLabel('default')).toBe('Default')
        expect(getPermissionModeLabel('acceptEdits')).toBe('Accept Edits')
        expect(getPermissionModeLabel('bypassPermissions')).toBe('Yolo')
        expect(getPermissionModeLabel('plan')).toBe('Plan Mode')
        expect(getPermissionModeLabel('yolo')).toBe('Yolo')
    })
})

describe('getPermissionModeTone', () => {
    it('returns correct tones', () => {
        expect(getPermissionModeTone('default')).toBe('neutral')
        expect(getPermissionModeTone('bypassPermissions')).toBe('danger')
        expect(getPermissionModeTone('yolo')).toBe('danger')
        expect(getPermissionModeTone('plan')).toBe('info')
        expect(getPermissionModeTone('acceptEdits')).toBe('warning')
    })
})

describe('getPermissionModesForFlavor', () => {
    it('returns Claude modes for undefined/null flavor', () => {
        expect(getPermissionModesForFlavor()).toEqual(CLAUDE_PERMISSION_MODES)
        expect(getPermissionModesForFlavor(null)).toEqual(CLAUDE_PERMISSION_MODES)
        expect(getPermissionModesForFlavor('claude')).toEqual(CLAUDE_PERMISSION_MODES)
    })

    it('returns Codex modes for codex flavor', () => {
        expect(getPermissionModesForFlavor('codex')).toEqual(CODEX_PERMISSION_MODES)
    })

    it('returns Gemini modes for gemini flavor', () => {
        expect(getPermissionModesForFlavor('gemini')).toEqual(GEMINI_PERMISSION_MODES)
    })

    it('returns OpenCode modes for opencode flavor', () => {
        expect(getPermissionModesForFlavor('opencode')).toEqual(OPENCODE_PERMISSION_MODES)
    })
})

describe('getPermissionModeOptionsForFlavor', () => {
    it('returns option objects with mode, label, and tone', () => {
        const options = getPermissionModeOptionsForFlavor('claude')
        expect(options).toHaveLength(CLAUDE_PERMISSION_MODES.length)
        for (const opt of options) {
            expect(opt).toHaveProperty('mode')
            expect(opt).toHaveProperty('label')
            expect(opt).toHaveProperty('tone')
        }
    })
})

describe('isPermissionModeAllowedForFlavor', () => {
    it('returns true for modes allowed by flavor', () => {
        expect(isPermissionModeAllowedForFlavor('default', 'claude')).toBe(true)
        expect(isPermissionModeAllowedForFlavor('yolo', 'codex')).toBe(true)
    })

    it('returns false for modes not allowed by flavor', () => {
        expect(isPermissionModeAllowedForFlavor('acceptEdits', 'codex')).toBe(false)
        expect(isPermissionModeAllowedForFlavor('plan', 'gemini')).toBe(false)
    })
})

describe('getModelModesForFlavor', () => {
    it('returns model modes for Claude (default)', () => {
        expect(getModelModesForFlavor()).toEqual(MODEL_MODES)
        expect(getModelModesForFlavor('claude')).toEqual(MODEL_MODES)
    })

    it('returns empty array for non-Claude flavors', () => {
        expect(getModelModesForFlavor('codex')).toEqual([])
        expect(getModelModesForFlavor('gemini')).toEqual([])
        expect(getModelModesForFlavor('opencode')).toEqual([])
    })
})

describe('isModelModeAllowedForFlavor', () => {
    it('allows model modes for Claude', () => {
        expect(isModelModeAllowedForFlavor('sonnet')).toBe(true)
        expect(isModelModeAllowedForFlavor('opus')).toBe(true)
    })

    it('disallows model modes for non-Claude', () => {
        expect(isModelModeAllowedForFlavor('sonnet', 'codex')).toBe(false)
    })
})

describe('constants', () => {
    it('PERMISSION_MODES includes all flavor-specific modes', () => {
        for (const mode of CLAUDE_PERMISSION_MODES) {
            expect(PERMISSION_MODES).toContain(mode)
        }
        for (const mode of CODEX_PERMISSION_MODES) {
            expect(PERMISSION_MODES).toContain(mode)
        }
    })
})
