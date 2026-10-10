import * as z from 'zod'

import { CharacterPrompt, ParametersPatch } from '../schemas/common'

export const PlaygroundStatePatch = z.object({
    prompt: z.string().optional(),
    negativePrompt: z.string().optional(),
    characterPrompts: z.array(CharacterPrompt).optional(),
    parameters: ParametersPatch.optional(),
})
export type PlaygroundStatePatch = z.infer<typeof PlaygroundStatePatch>

export const PlaygroundImageListQuery = z.object({
    limit: z.coerce.number().int().positive().max(100).optional(),
})
export type PlaygroundImageListQuery = z.infer<typeof PlaygroundImageListQuery>
