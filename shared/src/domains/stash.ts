import * as z from 'zod'
import { CharacterPrompt, Parameters, PromptVariable } from '../app'

export const StashType = z.enum(['prompt', 'scene', 'parameters'])

export const StashPromptPayload = z.object({
    prompt: z.string(),
    negativePrompt: z.string(),
    variables: PromptVariable,
    characterPrompts: z.array(CharacterPrompt),
})

export const StashSceneVariation = z.object({
    variables: PromptVariable,
})

export const StashScene = z.object({
    name: z.string().trim().min(1),
    variations: z.array(StashSceneVariation),
})

export const StashScenePayload = z.object({
    scenes: z.array(StashScene),
})

export const StashParametersPayload = Parameters

const StashItemBase = z.object({
    id: z.number(),
    name: z.string().trim().min(1),
    createdAt: z.string(),
    updatedAt: z.string(),
})

export const StashItem = z.discriminatedUnion('type', [
    StashItemBase.extend({
        type: z.literal('prompt'),
        payload: StashPromptPayload,
    }),
    StashItemBase.extend({
        type: z.literal('scene'),
        payload: StashScenePayload,
    }),
    StashItemBase.extend({
        type: z.literal('parameters'),
        payload: StashParametersPayload,
    }),
])

export const StashGetQuery = z.object({
    type: StashType.optional(),
})

export const StashPostBody = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('prompt'),
        name: z.string().trim().min(1),
        payload: StashPromptPayload,
    }),
    z.object({
        type: z.literal('scene'),
        name: z.string().trim().min(1),
        payload: StashScenePayload,
    }),
    z.object({
        type: z.literal('parameters'),
        name: z.string().trim().min(1),
        payload: StashParametersPayload,
    }),
])

export const StashPatchBody = z.object({
    name: z.string().trim().min(1).optional(),
    payload: z.union([StashPromptPayload, StashScenePayload, StashParametersPayload]).optional(),
})

export const StashApplyBody = z.object({
    projectId: z.number().int().positive(),
    mode: z.enum(['append', 'replace']).optional(),
})

export const StashApplyResult = z.object({
    applied: z.boolean(),
    imported: z.number().optional(),
})

export type StashType = z.infer<typeof StashType>
export type StashPromptPayload = z.infer<typeof StashPromptPayload>
export type StashSceneVariation = z.infer<typeof StashSceneVariation>
export type StashScene = z.infer<typeof StashScene>
export type StashScenePayload = z.infer<typeof StashScenePayload>
export type StashParametersPayload = z.infer<typeof StashParametersPayload>
export type StashItem = z.infer<typeof StashItem>
export type StashGetQuery = z.infer<typeof StashGetQuery>
export type StashPostBody = z.infer<typeof StashPostBody>
export type StashPatchBody = z.infer<typeof StashPatchBody>
export type StashApplyBody = z.infer<typeof StashApplyBody>
export type StashApplyResult = z.infer<typeof StashApplyResult>
