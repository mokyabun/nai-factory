import * as z from 'zod'
import { IdParams } from './shared'

export { IdParams as QueueIdParams }

export const QueueListQuery = z.object({
    projectId: z.coerce.number().optional(),
})

export const ClearQueueQuery = z.object({
    sceneId: z.coerce.number().optional(),
})

export const EnqueuePosition = z.enum(['back', 'front'])

export const EnqueueBody = z.object({
    sceneId: z.number(),
    position: EnqueuePosition.optional().default('back'),
})

export const EnqueueAllBody = z.object({
    projectId: z.number(),
    position: EnqueuePosition.optional().default('back'),
})

export const EnqueueBulkBody = z.object({
    sceneIds: z.array(z.number()).min(1),
    position: EnqueuePosition.optional().default('back'),
})

export type QueueListQuery = z.infer<typeof QueueListQuery>
export type ClearQueueQuery = z.infer<typeof ClearQueueQuery>
export type EnqueuePosition = z.infer<typeof EnqueuePosition>
export type EnqueueBody = z.infer<typeof EnqueueBody>
export type EnqueueAllBody = z.infer<typeof EnqueueAllBody>
export type EnqueueBulkBody = z.infer<typeof EnqueueBulkBody>
