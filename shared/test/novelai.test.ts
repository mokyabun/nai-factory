import { describe, expect, it } from 'bun:test'

import { DEFAULT_PROJECT_PARAMETERS, isFreeGeneration } from '../src'

describe('isFreeGeneration', () => {
    const at = (width: number, height: number, steps = 28) =>
        isFreeGeneration({ ...DEFAULT_PROJECT_PARAMETERS, width, height, steps })

    it('accepts normal sizes up to 28 steps', () => {
        expect(at(1216, 832)).toBe(true)
        expect(at(832, 1216)).toBe(true)
        expect(at(1024, 1024)).toBe(true)
    })

    it('rejects larger sizes or more steps', () => {
        expect(at(1536, 1024)).toBe(false)
        expect(at(1088, 1024)).toBe(false)
        expect(at(1216, 832, 29)).toBe(false)
    })
})
