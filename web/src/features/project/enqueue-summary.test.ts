import { DEFAULT_PROJECT_PARAMETERS } from '@nai-factory/shared'
import { describe, expect, it } from 'vitest'

import {
    describeEnqueueCost,
    describeEnqueueTotal,
    needsEnqueueConfirmation,
    summarizeSceneEnqueue,
} from './enqueue-summary'

const free = { ...DEFAULT_PROJECT_PARAMETERS, width: 832, height: 1216, steps: 28 }
const paid = { ...free, width: 1536, height: 1024 }

describe('enqueue summary', () => {
    it('multiplies variations by the image count', () => {
        const summary = summarizeSceneEnqueue(
            [{ variations: [1, 2] }, { variations: [1] }, { variations: [1, 2, 3] }],
            4,
            free,
        )
        expect(summary.total).toBe(24)
        expect(describeEnqueueTotal(summary)).toBe('씬 3개 × 변수 세트 6개 × 4장 = 24장')
        expect(describeEnqueueCost(summary)).toBeNull()
        expect(needsEnqueueConfirmation(summary)).toBe(false)
    })

    it('asks before large batches and mentions paid images', () => {
        const summary = summarizeSceneEnqueue([{ variations: Array(3) }], 100, paid)
        expect(needsEnqueueConfirmation(summary)).toBe(true)
        expect(describeEnqueueCost(summary)).toBe('300장 중 300장이 Anlas를 소모합니다')
    })
})
