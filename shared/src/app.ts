import { t } from 'elysia'
import {
    NovelAICharacterPrompt,
    NovelAIModel,
    NovelAINoiseSchedule,
    NovelAISampler,
} from './novelai'

export const Parameters = t.Object({
    width: t.Number(),
    height: t.Number(),
    steps: t.Number(),
    promptGuidance: t.Number(),
    varietyPlus: t.Boolean(),
    seed: t.Number(),
    sampler: NovelAISampler,
    promptGuidanceRescale: t.Number(),
    noiseSchedule: NovelAINoiseSchedule,
    normalizeReferenceStrengthValues: t.Boolean(),
    useCharacterPositions: t.Boolean(),
})
export type Parameters = typeof Parameters.static

export const GlobalSettings = t.Object({
    novelaiApiKey: t.String(),
    model: NovelAIModel,
    qualityToggle: t.Boolean(),
})
export type GlobalSettings = typeof GlobalSettings.static

export const CharacterPrompt = NovelAICharacterPrompt
export type CharacterPrompt = typeof CharacterPrompt.static

export type PromptVariable = Record<string, string>

export type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Prompt {
    prompt: string
    negativePrompt: string
    characterPrompts: CharacterPrompt[]
}

export interface VibeTransfer {
    sourceImagePath: string

    referenceStrength: number
    informationExtracted: number

    encodedDataPath?: string
    encodedInformationExtracted?: number
}
