import * as z from 'zod'

import { ParametersPatch } from '../schemas/common'
import { EnqueuePosition, JobStatus } from '../schemas/job'

export const MAX_IMAGES_PER_JOB = 100

const StatusList = z
    .string()
    .transform((value) => value.split(',').filter(Boolean))
    .pipe(z.array(JobStatus))

export const JobListQuery = z.object({
    /** Comma-separated statuses; defaults to `queued,running`. */
    status: StatusList.optional(),
    projectId: z.coerce.number().int().positive().optional(),
})
export type JobListQuery = z.infer<typeof JobListQuery>

export const JobHistoryQuery = z.object({
    limit: z.coerce.number().int().min(1).max(200).optional(),
})
export type JobHistoryQuery = z.infer<typeof JobHistoryQuery>

/** Exactly one of `variationIds`, `sceneIds` or `projectId` selects what to queue. */
export const SceneEnqueueBody = z
    .object({
        sceneIds: z.array(z.number().int().positive()).min(1).optional(),
        variationIds: z.array(z.number().int().positive()).min(1).optional(),
        projectId: z.number().int().positive().optional(),
        /** Images per variation; each is compiled from the latest prompt when it runs. */
        count: z.number().int().min(1).max(MAX_IMAGES_PER_JOB).optional(),
        position: EnqueuePosition.optional(),
    })
    .refine(
        (body) =>
            [body.sceneIds, body.variationIds, body.projectId].filter((v) => v !== undefined)
                .length === 1,
        { message: 'Specify exactly one of sceneIds, variationIds or projectId' },
    )
export type SceneEnqueueBody = z.infer<typeof SceneEnqueueBody>

/**
 * Queues the playground. Fields given here override the stored playground state, so unsaved
 * editor changes are included in the snapshot.
 */
export const PlaygroundEnqueueBody = z.object({
    prompt: z.string().optional(),
    negativePrompt: z.string().optional(),
    parameters: ParametersPatch.optional(),
    position: EnqueuePosition.optional(),
})
export type PlaygroundEnqueueBody = z.infer<typeof PlaygroundEnqueueBody>

export const JobClearQuery = z.object({
    sceneId: z.coerce.number().int().positive().optional(),
    variationId: z.coerce.number().int().positive().optional(),
})
export type JobClearQuery = z.infer<typeof JobClearQuery>
