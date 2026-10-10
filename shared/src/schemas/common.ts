import * as z from 'zod'

import {
    NovelAICharacterPrompt,
    NovelAIModel,
    NovelAINoiseSchedule,
    NovelAISampler,
} from '../novelai'

/** Timestamps cross the API as ISO-8601 UTC strings, e.g. `2026-10-08T03:12:45.123Z`. */
export const IsoDateTime = z.iso.datetime()
export type IsoDateTime = z.infer<typeof IsoDateTime>

export const Id = z.number().int().positive()

export const IMAGE_SIZE_STEP = 64
export const IMAGE_SIZE_MIN = 64
export const IMAGE_SIZE_MAX = 2048
/** Largest pixel count NovelAI accepts for a single generation. */
export const IMAGE_MAX_PIXELS = 3_145_728
export const STEPS_MAX = 50
export const PROMPT_GUIDANCE_MAX = 10
export const SEED_MAX = 4_294_967_295

const ImageDimension = z
    .number()
    .int()
    .min(IMAGE_SIZE_MIN)
    .max(IMAGE_SIZE_MAX)
    .multipleOf(IMAGE_SIZE_STEP)

const ParametersShape = {
    model: NovelAIModel,
    qualityToggle: z.boolean(),
    width: ImageDimension,
    height: ImageDimension,
    steps: z.number().int().min(1).max(STEPS_MAX),
    promptGuidance: z.number().min(0).max(PROMPT_GUIDANCE_MAX),
    varietyPlus: z.boolean(),
    /** 0 picks a random seed for every image. */
    seed: z.number().int().min(0).max(SEED_MAX),
    sampler: NovelAISampler,
    promptGuidanceRescale: z.number().min(0).max(1),
    noiseSchedule: NovelAINoiseSchedule,
    normalizeReferenceStrengthValues: z.boolean(),
    useCharacterPositions: z.boolean(),
}

export const Parameters = z.object(ParametersShape).check((ctx) => {
    if (ctx.value.width * ctx.value.height > IMAGE_MAX_PIXELS) {
        ctx.issues.push({
            code: 'custom',
            message: `width × height must not exceed ${IMAGE_MAX_PIXELS} pixels`,
            path: ['width'],
            input: ctx.value,
        })
    }
})
export type Parameters = z.infer<typeof Parameters>

/** Every field optional and without defaults; the server merges it into the stored value. */
export const ParametersPatch = z.object({
    model: ParametersShape.model.optional(),
    qualityToggle: ParametersShape.qualityToggle.optional(),
    width: ParametersShape.width.optional(),
    height: ParametersShape.height.optional(),
    steps: ParametersShape.steps.optional(),
    promptGuidance: ParametersShape.promptGuidance.optional(),
    varietyPlus: ParametersShape.varietyPlus.optional(),
    seed: ParametersShape.seed.optional(),
    sampler: ParametersShape.sampler.optional(),
    promptGuidanceRescale: ParametersShape.promptGuidanceRescale.optional(),
    noiseSchedule: ParametersShape.noiseSchedule.optional(),
    normalizeReferenceStrengthValues: ParametersShape.normalizeReferenceStrengthValues.optional(),
    useCharacterPositions: ParametersShape.useCharacterPositions.optional(),
})
export type ParametersPatch = z.infer<typeof ParametersPatch>

export const CharacterPrompt = NovelAICharacterPrompt
export type CharacterPrompt = z.infer<typeof CharacterPrompt>

export const PromptVariableItem = z.object({
    key: z.string().trim().min(1),
    value: z.string(),
})
export type PromptVariableItem = z.infer<typeof PromptVariableItem>

export const PromptVariable = z.array(PromptVariableItem).check((ctx) => {
    const seen = new Set<string>()
    for (const [index, variable] of ctx.value.entries()) {
        if (seen.has(variable.key)) {
            ctx.issues.push({
                code: 'custom',
                message: `Duplicate variable key: ${variable.key}`,
                path: [index, 'key'],
                input: ctx.value,
            })
        }
        seen.add(variable.key)
    }
})
export type PromptVariable = z.infer<typeof PromptVariable>

export interface Prompt {
    prompt: string
    negativePrompt: string
    characterPrompts: CharacterPrompt[]
}

/** Converts `[key, value]` tuples or `{ key: value }` records into the variable list format. */
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
            value:
                entryValue === null || entryValue === undefined
                    ? ''
                    : typeof entryValue === 'string'
                      ? entryValue
                      : JSON.stringify(entryValue),
        }))
    }

    return []
}

export const OkResponse = z.object({ ok: z.literal(true) })
export type OkResponse = z.infer<typeof OkResponse>
