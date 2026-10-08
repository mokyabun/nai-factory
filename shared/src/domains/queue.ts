import * as z from 'zod'

export const EnqueuePosition = z.enum(['back', 'front'])

export const QueueItem = z.object({
    id: z.number(),
    type: z.literal('scene').default('scene'),
    projectId: z.number(),
    sceneId: z.number(),
    sceneVariationId: z.number(),
    sceneName: z.string().optional(),

    sortIndex: z.number(),
})

export const PlaygroundQueueItem = z.object({
    id: z.number(),
    type: z.literal('playground'),
    prompt: z.string(),
    sortIndex: z.number(),
})

export const AnyQueueItem = z.union([QueueItem, PlaygroundQueueItem])

export const QueueGetQuery = z.object({
    projectId: z.coerce.number().int().positive().optional(),
})

export const QueueClearQuery = z.object({
    sceneId: z.coerce.number().int().positive().optional(),
    sceneVariationId: z.coerce.number().int().positive().optional(),
})

export const QueueEnqueueBody = z.object({
    sceneId: z.number().int().positive(),
    sceneVariationId: z.number().int().positive().optional(),
    position: EnqueuePosition.optional(),
})

export const QueueEnqueueAllBody = z.object({
    projectId: z.number().int().positive(),
    position: EnqueuePosition.optional(),
})

export const QueueEnqueueBulkBody = z.object({
    sceneIds: z.array(z.number().int().positive()).min(1),
    position: EnqueuePosition.optional(),
})

export type EnqueuePosition = z.infer<typeof EnqueuePosition>
export type QueueItem = z.infer<typeof QueueItem>
export type PlaygroundQueueItem = z.infer<typeof PlaygroundQueueItem>
export type AnyQueueItem = z.infer<typeof AnyQueueItem>
export type QueueGetQuery = z.infer<typeof QueueGetQuery>
export type QueueClearQuery = z.infer<typeof QueueClearQuery>
export type QueueEnqueueBody = z.infer<typeof QueueEnqueueBody>
export type QueueEnqueueAllBody = z.infer<typeof QueueEnqueueAllBody>
export type QueueEnqueueBulkBody = z.infer<typeof QueueEnqueueBulkBody>

export type QueueJobType = 'scene' | 'playground'

/**
 * - `running`: jobs are being processed.
 * - `pausing`: a stop was requested; the current job finishes before the queue halts.
 * - `paused`: halted with jobs still waiting (by the user or after a failure).
 * - `idle`: nothing is waiting.
 */
export type QueueState = 'idle' | 'running' | 'pausing' | 'paused'

export type QueuePauseReason = 'user' | 'failure'

export type QueueStatusJob = {
    id: number
    type: QueueJobType
    projectId: number | null
    sceneId: number | null
    sceneVariationId: number | null
    sceneName: string
    prompt: string | null
    startedAt: string
    /** Images this job will generate; null until its prompts are compiled. */
    imageCount: number | null
    /** Images saved so far by this job. */
    savedImageCount: number
    /** When the image currently being generated was requested; null while preparing. */
    imageStartedAt: string | null
}

export type QueueHistoryEntry = {
    id: number
    jobId: number
    type: QueueJobType
    projectId: number | null
    sceneId: number | null
    sceneVariationId: number | null
    sceneName: string
    prompt: string | null
    status: 'completed' | 'failed'
    startedAt: string
    durationMs: number
    completedAt: string
    error: string | null
    failureCategory: string | null
}

export type QueueStatus = {
    state: QueueState
    pauseReason: QueuePauseReason | null
    running: boolean
    processing: boolean
    /** Queued jobs, including the one currently running. */
    pendingCount: number
    /** Estimated time until every queued job finishes; null without duration samples. */
    estimatedSeconds: number | null
    currentSceneId: number | null
    currentJob: QueueStatusJob | null
    /** Average duration of a single image generation. */
    avgDurationMs: number | null
    durationSampleSize: number
    completedCount: number
    failedCount: number
    recent: QueueHistoryEntry[]
    /** Server clock when the status was produced, for correcting client clock skew. */
    serverTime: string
}
