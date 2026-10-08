import * as z from 'zod'

import { CharacterPrompt, IsoDateTime, Parameters, PromptVariable } from './common'

export const StashType = z.enum(['prompt', 'scene', 'parameters'])
export type StashType = z.infer<typeof StashType>

export const StashPromptPayload = z.object({
    prompt: z.string(),
    negativePrompt: z.string(),
    variables: PromptVariable,
    characterPrompts: z.array(CharacterPrompt),
})
export type StashPromptPayload = z.infer<typeof StashPromptPayload>

export const StashScene = z.object({
    name: z.string().trim().min(1),
    variations: z.array(z.object({ variables: PromptVariable })),
})
export type StashScene = z.infer<typeof StashScene>

export const StashScenePayload = z.object({ scenes: z.array(StashScene) })
export type StashScenePayload = z.infer<typeof StashScenePayload>

export const StashParametersPayload = Parameters
export type StashParametersPayload = z.infer<typeof StashParametersPayload>

export const STASH_PAYLOADS = {
    prompt: StashPromptPayload,
    scene: StashScenePayload,
    parameters: StashParametersPayload,
} as const

const StashItemBase = z.object({
    id: z.number(),
    name: z.string(),
    createdAt: IsoDateTime,
    updatedAt: IsoDateTime,
})

export const StashItem = z.discriminatedUnion('type', [
    StashItemBase.extend({ type: z.literal('prompt'), payload: StashPromptPayload }),
    StashItemBase.extend({ type: z.literal('scene'), payload: StashScenePayload }),
    StashItemBase.extend({ type: z.literal('parameters'), payload: StashParametersPayload }),
])
export type StashItem = z.infer<typeof StashItem>

export const StashApplyResult = z.object({
    applied: z.boolean(),
    imported: z.number().optional(),
})
export type StashApplyResult = z.infer<typeof StashApplyResult>
