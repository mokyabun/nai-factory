import type { QueueJobType, QueueState } from '@nai-factory/shared'

export class RollingSamples {
    private readonly samples: number[] = []

    constructor(private readonly capacity: number) {}

    push(value: number) {
        this.samples.push(value)
        if (this.samples.length > this.capacity) this.samples.shift()
    }

    get size() {
        return this.samples.length
    }

    average() {
        if (this.samples.length === 0) return null

        return this.samples.reduce((a, b) => a + b, 0) / this.samples.length
    }
}

export function deriveQueueState(input: {
    running: boolean
    processing: boolean
    pendingCount: number
}): QueueState {
    if (input.processing) return input.running ? 'running' : 'pausing'
    if (input.pendingCount > 0) return 'paused'

    return 'idle'
}

export type QueueEstimateInput = {
    now: number
    /** Waiting jobs per type, excluding the job currently running. */
    waiting: Record<QueueJobType, number>
    avgImageMs: number | null
    avgJobMs: Record<QueueJobType, number | null>
    current: {
        type: QueueJobType
        imageCount: number | null
        savedImageCount: number
        imageStartedAtMs: number | null
    } | null
}

/**
 * Estimates the milliseconds left until the queue drains.
 *
 * Waiting jobs are estimated per job because a scene job's image count is only known once its
 * prompts are compiled at execution time. The running job is estimated per image once that count
 * is known. Returns null when there are no duration samples to estimate from.
 */
export function estimateRemainingMs(input: QueueEstimateInput): number | null {
    const jobMs = (type: QueueJobType) => input.avgJobMs[type] ?? input.avgImageMs

    let total = 0

    for (const type of ['scene', 'playground'] as const) {
        const count = input.waiting[type]
        if (count === 0) continue

        const average = jobMs(type)
        if (average === null) return null
        total += average * count
    }

    const current = input.current
    if (current) {
        if (current.imageCount !== null && input.avgImageMs !== null) {
            const remainingImages = Math.max(0, current.imageCount - current.savedImageCount)
            const elapsedOnImage =
                current.imageStartedAtMs !== null ? input.now - current.imageStartedAtMs : 0
            total += Math.max(0, remainingImages * input.avgImageMs - elapsedOnImage)
        } else {
            const average = jobMs(current.type)
            if (average === null) return null
            total += average
        }
    }

    return total
}
