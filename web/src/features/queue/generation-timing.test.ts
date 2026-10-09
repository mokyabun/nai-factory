import { describe, expect, it } from 'vitest'

import { formatSeconds, imageProgress, remainingSeconds, toServerNow } from './generation-timing'

const t = (seconds: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, seconds)).toISOString()
const ms = (seconds: number) => Date.parse(t(seconds))

describe('generation progress', () => {
    it('corrects for a client clock ahead of the server', () => {
        // The client clock runs 5s ahead: the status stamped at server 10s arrived at local 15s.
        expect(toServerNow(ms(20), t(10), ms(15))).toBe(ms(15))
    })

    it('never reads the clock earlier than the status arrival', () => {
        expect(toServerNow(ms(0), t(10), ms(10))).toBe(ms(10))
    })

    it('caps the estimated ratio until the image is saved', () => {
        const progress = imageProgress(t(0), 10_000, ms(30))

        expect(progress?.ratio).toBe(0.95)
        expect(progress?.overrun).toBe(true)
    })

    it('reports progress against the estimate', () => {
        const progress = imageProgress(t(0), 10_000, ms(4))

        expect(progress).toEqual({
            startedAt: t(0),
            elapsedMs: 4000,
            estimateMs: 10_000,
            ratio: 0.4,
            overrun: false,
        })
    })

    it('has no ratio without an estimate', () => {
        expect(imageProgress(t(0), null, ms(4))?.ratio).toBeNull()
        expect(imageProgress(null, 10_000, ms(4))).toBeNull()
    })

    it('counts the remaining estimate down between refreshes', () => {
        expect(remainingSeconds(60, t(0), ms(15))).toBe(45)
        expect(remainingSeconds(10, t(0), ms(15))).toBe(0)
        expect(remainingSeconds(null, t(0), ms(15))).toBeNull()
    })

    it('formats durations', () => {
        expect(formatSeconds(42)).toBe('42초')
        expect(formatSeconds(61)).toBe('2분')
        expect(formatSeconds(3600)).toBe('1시간')
        expect(formatSeconds(3900)).toBe('1시간 5분')
    })
})
