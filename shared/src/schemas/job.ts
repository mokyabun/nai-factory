import * as z from 'zod'

import { CharacterPrompt, IsoDateTime, Parameters } from './common'

export const MAX_IMAGES_PER_JOB = 100

export const JobKind = z.enum(['scene', 'playground'])
export type JobKind = z.infer<typeof JobKind>

export const JobStatus = z.enum(['queued', 'running', 'completed', 'failed', 'cancelled'])
export type JobStatus = z.infer<typeof JobStatus>

export const JobErrorKind = z.enum(['config', 'auth', 'rate_limit', 'network', 'prompt', 'runtime'])
export type JobErrorKind = z.infer<typeof JobErrorKind>

export const EnqueuePosition = z.enum(['front', 'back'])
export type EnqueuePosition = z.infer<typeof EnqueuePosition>

/** Prompt snapshot stored with a playground job when it is queued. */
export const PlaygroundJobPayload = z.object({
    prompt: z.string(),
    negativePrompt: z.string(),
    /** Missing from jobs queued before 0.4.0. */
    characterPrompts: z.array(CharacterPrompt).default([]),
    parameters: Parameters,
})
export type PlaygroundJobPayload = z.infer<typeof PlaygroundJobPayload>

export const Job = z.object({
    id: z.number(),
    kind: JobKind,
    status: JobStatus,
    position: z.string(),
    projectId: z.number().nullable(),
    sceneId: z.number().nullable(),
    variationId: z.number().nullable(),
    /** Scene name for scene jobs, `Playground` otherwise. */
    label: z.string(),
    /** Snapshot prompt of a playground job. */
    prompt: z.string().nullable(),
    /** Images the job generates; null until its prompts are compiled. */
    totalImages: z.number().nullable(),
    doneImages: z.number(),
    error: z.string().nullable(),
    errorKind: JobErrorKind.nullable(),
    createdAt: IsoDateTime,
    startedAt: IsoDateTime.nullable(),
    finishedAt: IsoDateTime.nullable(),
})
export type Job = z.infer<typeof Job>

/** `pausing`: the current image finishes before the queue halts. */
export const QueueState = z.enum(['idle', 'running', 'pausing', 'paused'])
export type QueueState = z.infer<typeof QueueState>

export const QueuePauseReason = z.enum(['user', 'failure'])
export type QueuePauseReason = z.infer<typeof QueuePauseReason>

export const QueueCurrentJob = z.object({
    jobId: z.number(),
    kind: JobKind,
    projectId: z.number().nullable(),
    sceneId: z.number().nullable(),
    variationId: z.number().nullable(),
    label: z.string(),
    prompt: z.string().nullable(),
    startedAt: IsoDateTime,
    total: z.number().nullable(),
    done: z.number(),
    /** When the image currently being generated was requested; null while preparing. */
    imageStartedAt: IsoDateTime.nullable(),
})
export type QueueCurrentJob = z.infer<typeof QueueCurrentJob>

export const QueueStatus = z.object({
    state: QueueState,
    pauseReason: QueuePauseReason.nullable(),
    /** Queued jobs, including the one currently running. */
    pendingCount: z.number(),
    /** Images those jobs still have to generate. */
    pendingImages: z.number(),
    /** Estimated seconds until every queued job finishes; null without duration samples. */
    estimatedSeconds: z.number().nullable(),
    current: QueueCurrentJob.nullable(),
    avgImageMs: z.number().nullable(),
    sampleSize: z.number(),
    completedCount: z.number(),
    failedCount: z.number(),
    /** Server clock, for correcting client clock skew in progress displays. */
    serverTime: IsoDateTime,
})
export type QueueStatus = z.infer<typeof QueueStatus>

export const EnqueueResult = z.object({ queued: z.number(), jobIds: z.array(z.number()) })
export type EnqueueResult = z.infer<typeof EnqueueResult>

export const ClearJobsResult = z.object({ cancelled: z.number() })
export type ClearJobsResult = z.infer<typeof ClearJobsResult>
