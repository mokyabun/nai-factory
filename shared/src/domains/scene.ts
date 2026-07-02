import * as z from 'zod'
import { CharacterPrompt, PromptVariable } from '../app'
import { OptionalOrderBody } from './common'

export const PromptVariation = PromptVariable

export const ScenePreviewPrompt = z.object({
    prompt: z.string(),
    negativePrompt: z.string(),
    characterPrompts: z.array(CharacterPrompt),
})

export const ScenePreviewRenderError = z.object({
    message: z.string(),
    category: z.string(),
})

export const ScenePreviewResult = z.discriminatedUnion('ok', [
    z.object({
        ok: z.literal(true),
        prompts: z.array(ScenePreviewPrompt),
    }),
    z.object({
        ok: z.literal(false),
        error: ScenePreviewRenderError,
    }),
])

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

export type PromptVariation = z.infer<typeof PromptVariation>
export type ScenePreviewPrompt = z.infer<typeof ScenePreviewPrompt>
export type ScenePreviewRenderError = z.infer<typeof ScenePreviewRenderError>
export type ScenePreviewResult = z.infer<typeof ScenePreviewResult>
export type SceneVariation = z.infer<typeof SceneVariation>
export type SceneVariationDraft = z.infer<typeof SceneVariationDraft>
export type Scene = z.infer<typeof Scene>
export type SceneGetQuery = z.infer<typeof SceneGetQuery>
export type ScenePostBody = z.infer<typeof ScenePostBody>
export type ScenePatchBody = z.infer<typeof ScenePatchBody>
export type SceneOrderPatchBody = z.infer<typeof SceneOrderPatchBody>
export type ScenePreviewGetQuery = z.infer<typeof ScenePreviewGetQuery>
