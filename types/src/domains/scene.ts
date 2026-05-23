import * as z from 'zod'
import { IdParams } from './shared'

export { IdParams as SceneIdParams }

export const SceneListQuery = z.object({
    projectId: z.coerce.number(),
})

export const ScenePreviewQuery = z.object({
    variationId: z.coerce.number().optional(),
})

export const CreateSceneBody = z.object({
    projectId: z.number(),
    name: z.string().min(1),
})

export const UpdateSceneBody = z.object({
    name: z.string().min(1).optional(),
    variations: z.array(z.record(z.string(), z.string())).optional(),
})

export const ReorderSceneBody = z.object({
    prevId: z.number().nullable(),
    nextId: z.number().nullable(),
})

export type SceneListQuery = z.infer<typeof SceneListQuery>
export type ScenePreviewQuery = z.infer<typeof ScenePreviewQuery>
export type CreateSceneBody = z.infer<typeof CreateSceneBody>
export type UpdateSceneBody = z.infer<typeof UpdateSceneBody>
export type ReorderSceneBody = z.infer<typeof ReorderSceneBody>
