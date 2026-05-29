import * as z from 'zod'
import {
    NovelAICharacterPrompt,
    NovelAIModel,
    NovelAINoiseSchedule,
    NovelAISampler,
} from './novelai'

export const Parameters = z.object({
    model: NovelAIModel,
    qualityToggle: z.boolean(),

    width: z.number(),
    height: z.number(),

    steps: z.number(),
    promptGuidance: z.number(),
    varietyPlus: z.boolean(),

    seed: z.number(),

    sampler: NovelAISampler,
    promptGuidanceRescale: z.number(),
    noiseSchedule: NovelAINoiseSchedule,

    normalizeReferenceStrengthValues: z.boolean(),
    useCharacterPositions: z.boolean(),
})
export type Parameters = z.infer<typeof Parameters>

export const CharacterPrompt = NovelAICharacterPrompt
export type CharacterPrompt = z.infer<typeof CharacterPrompt>

export type PromptVariable = Record<string, string>

export type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Prompt {
    prompt: string
    negativePrompt: string
    characterPrompts: CharacterPrompt[]
}
