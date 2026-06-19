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

export const PromptVariableItem = z.object({
    key: z.string().trim().min(1),
    value: z.string(),
})
export type PromptVariableItem = z.infer<typeof PromptVariableItem>

export const PromptVariable = z.array(PromptVariableItem).superRefine((variables, ctx) => {
    const seen = new Set<string>()
    for (const [index, variable] of variables.entries()) {
        if (seen.has(variable.key)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Duplicate variable key: ${variable.key}`,
                path: [index, 'key'],
            })
        }
        seen.add(variable.key)
    }
})
export type PromptVariable = z.infer<typeof PromptVariable>

export function normalizePromptVariables(value: unknown): PromptVariable {
    if (Array.isArray(value)) {
        return value.map((item) => {
            if (Array.isArray(item)) {
                return { key: String(item[0] ?? ''), value: String(item[1] ?? '') }
            }
            if (item && typeof item === 'object') {
                const entry = item as Partial<PromptVariableItem>
                return { key: String(entry.key ?? ''), value: String(entry.value ?? '') }
            }
            return { key: '', value: '' }
        })
    }

    if (value && typeof value === 'object') {
        return Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => ({
            key,
            value: String(entryValue ?? ''),
        }))
    }

    return []
}

export type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Prompt {
    prompt: string
    negativePrompt: string
    characterPrompts: CharacterPrompt[]
}
