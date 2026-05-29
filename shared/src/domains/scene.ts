import * as z from 'zod'
import { IdParams, OptionalOrderBody } from './common'

export const PromptVariation = z.record(z.string(), z.string())

export const SceneVariation = z.object({
    id: z.number(),
    sceneId: z.number(),
    displayOrder: z.string(),
    variables: PromptVariation,
    createdAt: z.string(),
    updatedAt: z.string(),
})

export const SceneVariationDraft = z.object({
    id: z.number().optional(),
    displayOrder: z.string().optional(),
    variables: PromptVariation,
})

export const Scene = z.object({
    id: z.number(),
    projectId: z.number(),

    displayOrder: z.string(),
    name: z.string(),
    variations: z.array(SceneVariation),

    createdAt: z.string(),
    updatedAt: z.string(),
})

export const SceneGetQuery = z.object({
    projectId: z.coerce.number().int().positive(),
})

export const ScenePostBody = z.object({
    projectId: z.number().int().positive(),
    name: z.string().min(1),
})

export const ScenePatchBody = z.object({
    name: z.string().min(1).optional(),
    variations: z.array(SceneVariationDraft).optional(),
})

export const SceneOrderPatchBody = OptionalOrderBody

export const ScenePreviewGetQuery = z.object({
    variationId: z.coerce.number().int().positive().optional(),
})

export const SceneIdParams = IdParams
export const SceneListQuery = SceneGetQuery
export const CreateSceneBody = ScenePostBody
export const UpdateSceneBody = ScenePatchBody
export const ReorderSceneBody = SceneOrderPatchBody
export const ScenePreviewQuery = ScenePreviewGetQuery

export type PromptVariation = z.infer<typeof PromptVariation>
export type SceneVariation = z.infer<typeof SceneVariation>
export type SceneVariationDraft = z.infer<typeof SceneVariationDraft>
export type Scene = z.infer<typeof Scene>
export type SceneGetQuery = z.infer<typeof SceneGetQuery>
export type ScenePostBody = z.infer<typeof ScenePostBody>
export type ScenePatchBody = z.infer<typeof ScenePatchBody>
export type SceneOrderPatchBody = z.infer<typeof SceneOrderPatchBody>
export type ScenePreviewGetQuery = z.infer<typeof ScenePreviewGetQuery>
export type SceneIdParams = z.infer<typeof SceneIdParams>
export type SceneListQuery = SceneGetQuery
export type CreateSceneBody = ScenePostBody
export type UpdateSceneBody = ScenePatchBody
export type ReorderSceneBody = SceneOrderPatchBody
export type ScenePreviewQuery = ScenePreviewGetQuery
