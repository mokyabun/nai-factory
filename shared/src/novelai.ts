import * as z from 'zod'

export const NOVEL_AI_MODELS = [
    'nai-diffusion-5-full',
    'nai-diffusion-5-curated',
    'nai-diffusion-4-5-full',
    'nai-diffusion-4-5-curated',
    'nai-diffusion-4-full',
    'nai-diffusion-4-curated',
] as const

export const NovelAIModel = z.enum(NOVEL_AI_MODELS)
export type NovelAIModel = z.infer<typeof NovelAIModel>

export function isNovelAIV5Model(model: string): boolean {
    return model === 'nai-diffusion-5-full' || model === 'nai-diffusion-5-curated'
}

export function supportsCharacterReference(model: string): boolean {
    return model.includes('4-5')
}

export const NOVEL_AI_MODEL_OPTIONS = [
    { label: 'NAI Diffusion 5 Full', value: 'nai-diffusion-5-full' },
    { label: 'NAI Diffusion 5 Curated', value: 'nai-diffusion-5-curated' },
    { label: 'NAI Diffusion 4.5 Full', value: 'nai-diffusion-4-5-full' },
    { label: 'NAI Diffusion 4.5 Curated', value: 'nai-diffusion-4-5-curated' },
    { label: 'NAI Diffusion 4 Full', value: 'nai-diffusion-4-full' },
    { label: 'NAI Diffusion 4 Curated', value: 'nai-diffusion-4-curated' },
] as const satisfies readonly { label: string; value: NovelAIModel }[]

export const NOVEL_AI_NOISE_SCHEDULES = [
    'native',
    'karras',
    'exponential',
    'polyexponential',
] as const

export const NovelAINoiseSchedule = z.enum(NOVEL_AI_NOISE_SCHEDULES)
export type NovelAINoiseSchedule = z.infer<typeof NovelAINoiseSchedule>

export const NOVEL_AI_NOISE_SCHEDULE_OPTIONS = [
    { label: 'Native', value: 'native' },
    { label: 'Karras', value: 'karras' },
    { label: 'Exponential', value: 'exponential' },
    { label: 'Polyexponential', value: 'polyexponential' },
] as const satisfies readonly { label: string; value: NovelAINoiseSchedule }[]

export const NOVEL_AI_SAMPLERS = [
    'k_euler_ancestral',
    'k_euler',
    'k_dpmpp_2s_ancestral',
    'k_dpmpp_2m',
    'k_dpmpp_sde',
    'k_dpmpp_2m_sde',
    'dimm_v3',
] as const

export const NovelAISampler = z.enum(NOVEL_AI_SAMPLERS)
export type NovelAISampler = z.infer<typeof NovelAISampler>

export const NOVEL_AI_SAMPLER_OPTIONS = [
    { label: 'Euler Ancestral', value: 'k_euler_ancestral' },
    { label: 'Euler', value: 'k_euler' },
    { label: 'DPM++ 2S Ancestral', value: 'k_dpmpp_2s_ancestral' },
    { label: 'DPM++ 2M', value: 'k_dpmpp_2m' },
    { label: 'DPM++ SDE', value: 'k_dpmpp_sde' },
    { label: 'DPM++ 2M SDE', value: 'k_dpmpp_2m_sde' },
    { label: 'DIMM v3', value: 'dimm_v3' },
] as const satisfies readonly { label: string; value: NovelAISampler }[]

export const NovelAICharacterPrompt = z.object({
    enabled: z.boolean(),
    center: z.object({ x: z.number(), y: z.number() }),
    prompt: z.string(),
    uc: z.string(),
})
export type NovelAICharacterPrompt = z.infer<typeof NovelAICharacterPrompt>

/** Cell centers of NovelAI's 5×5 character position grid, per axis. */
export const CHARACTER_GRID_STEPS = [0.1, 0.3, 0.5, 0.7, 0.9] as const

export const DEFAULT_CHARACTER_CENTER = { x: 0.5, y: 0.5 }

const CHARACTER_GRID_COLUMNS = ['A', 'B', 'C', 'D', 'E'] as const

function nearestGridIndex(value: number) {
    const index = Math.round((value - CHARACTER_GRID_STEPS[0]) / 0.2)
    return Math.min(CHARACTER_GRID_STEPS.length - 1, Math.max(0, index))
}

/** Grid cell of a center as NovelAI names it: column `A`–`E` from the left, row `1`–`5` from the top. */
export function characterGridCell(center: { x: number; y: number }) {
    return `${CHARACTER_GRID_COLUMNS[nearestGridIndex(center.x)]}${nearestGridIndex(center.y) + 1}`
}

export const FREE_GENERATION_MAX_PIXELS = 1024 * 1024
export const FREE_GENERATION_MAX_STEPS = 28

/** Opus rule from docs.novelai.net/en/subscription: one image, at most 1024×1024 pixels and 28 steps. */
export function isFreeGeneration(parameters: { width: number; height: number; steps: number }) {
    return (
        parameters.width * parameters.height <= FREE_GENERATION_MAX_PIXELS &&
        parameters.steps <= FREE_GENERATION_MAX_STEPS
    )
}
