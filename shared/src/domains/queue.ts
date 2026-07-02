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
