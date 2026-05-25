import * as z from 'zod'
import { IdParams } from './common'

export const EnqueuePosition = z.enum(['back', 'front'])

export const QueueItem = z.object({
    id: z.number(),
    projectId: z.number(),
    sceneId: z.number(),
    sceneVariationId: z.number(),

    sortIndex: z.number(),
})

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

export const QueueIdParams = IdParams
export const QueueListQuery = QueueGetQuery
export const ClearQueueQuery = QueueClearQuery
export const EnqueueBody = QueueEnqueueBody
export const EnqueueAllBody = QueueEnqueueAllBody
export const EnqueueBulkBody = QueueEnqueueBulkBody

export type EnqueuePosition = z.infer<typeof EnqueuePosition>
export type QueueItem = z.infer<typeof QueueItem>
export type QueueGetQuery = z.infer<typeof QueueGetQuery>
export type QueueClearQuery = z.infer<typeof QueueClearQuery>
export type QueueEnqueueBody = z.infer<typeof QueueEnqueueBody>
export type QueueEnqueueAllBody = z.infer<typeof QueueEnqueueAllBody>
export type QueueEnqueueBulkBody = z.infer<typeof QueueEnqueueBulkBody>
export type QueueIdParams = z.infer<typeof QueueIdParams>
export type QueueListQuery = QueueGetQuery
export type ClearQueueQuery = QueueClearQuery
export type EnqueueBody = QueueEnqueueBody
export type EnqueueAllBody = QueueEnqueueAllBody
export type EnqueueBulkBody = QueueEnqueueBulkBody
