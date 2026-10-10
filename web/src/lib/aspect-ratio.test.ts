import { describe, expect, it } from 'vitest'

import { aspectRatio, recordedAspectRatio } from './aspect-ratio'

describe('aspectRatio', () => {
    it('keeps ratios between 1:2 and 2:1', () => {
        expect(aspectRatio({ width: 832, height: 1216 })).toBeCloseTo(832 / 1216)
    })

    it('clamps extreme sizes to 1:2 and 2:1', () => {
        expect(aspectRatio({ width: 64, height: 2048 })).toBe(0.5)
        expect(aspectRatio({ width: 2048, height: 64 })).toBe(2)
    })
})

describe('recordedAspectRatio', () => {
    it('reads the recorded resolution', () => {
        expect(recordedAspectRatio({ parameters: { width: 1216, height: 832 } })).toBeCloseTo(
            1216 / 832,
        )
    })

    it('falls back to square without a valid resolution', () => {
        expect(recordedAspectRatio({})).toBe(1)
        expect(recordedAspectRatio({ parameters: { width: 0, height: 832 } })).toBe(1)
    })
})
