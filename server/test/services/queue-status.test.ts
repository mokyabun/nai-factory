import { describe, expect, it } from 'bun:test'

import {
    deriveQueueState,
    estimateRemainingMs,
    type QueueEstimateInput,
    RollingSamples,
} from '../../src/services/app/queue-status'

function input(overrides: Partial<QueueEstimateInput>): QueueEstimateInput {
    return {
        now: 100_000,
        waiting: { scene: 0, playground: 0 },
        avgImageMs: null,
        avgJobMs: { scene: null, playground: null },
        current: null,
        ...overrides,
    }
}

describe('queue state', () => {
    it('reports pausing while the current job finishes after a stop', () => {
        expect(deriveQueueState({ running: false, processing: true, pendingCount: 3 })).toBe(
            'pausing',
        )
    })

    it('distinguishes paused from idle by waiting jobs', () => {
        expect(deriveQueueState({ running: false, processing: false, pendingCount: 2 })).toBe(
            'paused',
        )
        expect(deriveQueueState({ running: false, processing: false, pendingCount: 0 })).toBe(
            'idle',
        )
    })

    it('reports running while processing', () => {
        expect(deriveQueueState({ running: true, processing: true, pendingCount: 1 })).toBe(
            'running',
        )
    })
})

describe('queue estimate', () => {
    it('estimates waiting scene jobs by job duration, not image duration', () => {
        const estimate = estimateRemainingMs(
            input({
                waiting: { scene: 3, playground: 0 },
                avgImageMs: 10_000,
                avgJobMs: { scene: 40_000, playground: null },
            }),
        )

        expect(estimate).toBe(120_000)
    })

    it('falls back to image duration for job types without samples', () => {
        const estimate = estimateRemainingMs(
            input({
                waiting: { scene: 0, playground: 2 },
                avgImageMs: 10_000,
                avgJobMs: { scene: 40_000, playground: null },
            }),
        )

        expect(estimate).toBe(20_000)
    })

    it('estimates the running job by its remaining images', () => {
        const estimate = estimateRemainingMs(
            input({
                avgImageMs: 10_000,
                current: {
                    type: 'scene',
                    imageCount: 5,
                    savedImageCount: 2,
                    imageStartedAtMs: 96_000,
                },
            }),
        )

        // Three images left, four seconds into the first of them.
        expect(estimate).toBe(26_000)
    })

    it('does not go negative when an image overruns its estimate', () => {
        const estimate = estimateRemainingMs(
            input({
                avgImageMs: 10_000,
                current: {
                    type: 'playground',
                    imageCount: 1,
                    savedImageCount: 0,
                    imageStartedAtMs: 50_000,
                },
            }),
        )

        expect(estimate).toBe(0)
    })

    it('returns null without duration samples', () => {
        expect(estimateRemainingMs(input({ waiting: { scene: 1, playground: 0 } }))).toBeNull()
    })
})

describe('rolling samples', () => {
    it('keeps only the most recent samples', () => {
        const samples = new RollingSamples(2)
        samples.push(10)
        samples.push(20)
        samples.push(30)

        expect(samples.size).toBe(2)
        expect(samples.average()).toBe(25)
    })
})
