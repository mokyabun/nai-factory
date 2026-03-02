import { t } from 'elysia'

export const NovelAIModel = t.Union([
    t.Literal('nai-diffusion-4-5-full'),
    t.Literal('nai-diffusion-4-5-curated'),
    t.Literal('nai-diffusion-4-full'),
    t.Literal('nai-diffusion-4-curated'),
])
export type NovelAIModel = typeof NovelAIModel.static

export const NovelAINoiseSchedule = t.Union([
    t.Literal('native'),
    t.Literal('karras'),
    t.Literal('exponential'),
    t.Literal('polyexponential'),
])
export type NovelAINoiseSchedule = typeof NovelAINoiseSchedule.static

export const NovelAISampler = t.Union([
    t.Literal('k_euler_ancestral'),
    t.Literal('k_euler'),
    t.Literal('k_dpmpp_2s_ancestral'),
    t.Literal('k_dpmpp_2m'),
    t.Literal('k_dpmpp_sde'),
    t.Literal('k_dpmpp_2m_sde'),
    t.Literal('dimm_v3'),
])
export type NovelAISampler = typeof NovelAISampler.static

export interface NovelAICharacterPrompt {
    enabled: boolean
    center: { x: number; y: number }
    prompt: string
    uc: string // negative prompt
}

export interface NovelAICaption {
    base_caption: string
    char_captions: {
        char_caption: string
        centers: { x: number; y: number }[]
    }[]
}

export interface NovelAIV4Prompt {
    caption: NovelAICaption
    use_coords: boolean
    use_order: boolean
}

export interface NovelAIV4NegativePrompt {
    caption: NovelAICaption
    legacy_uc: boolean
}

export interface SimpleNovelAIParameters {
    prompt: string
    negativePrompt: string
    characterPrompts: NovelAICharacterPrompt[]

    vibeTransfers: NovelAIVibeImage[]

    model: NovelAIModel

    width: number
    height: number

    steps: number
    promptGuidance: number
    varietyPlus: boolean
    seed: number
    sampler: NovelAISampler
    promptGuidanceRescale: number
    noiseSchedule: NovelAINoiseSchedule

    normalizeReferenceStrengthValues: boolean
    useCharacterPositions: boolean

    qualityToggle: boolean
}

export interface NovelAIParameters {
    params_version: number

    characterPrompts: NovelAICharacterPrompt[]
    negative_prompt: string

    width: number
    height: number

    qualityToggle: boolean
    image_format: 'png'

    steps: number
    scale: number
    seed: number
    sampler: NovelAISampler
    cfg_rescale: number
    noise_schedule: NovelAINoiseSchedule

    normalize_reference_strength_multiple: boolean
    reference_image_multiple: string[]
    reference_strength_multiple: number[]

    autoSmea: boolean
    n_samples: number
    ucPreset: number
    controlnet_strength: number
    dynamic_thresholding: boolean
    prefer_brownian: boolean

    use_coords: boolean
    add_original_image: boolean
    inpaintImg2ImgStrength: number
    skip_cfg_above_sigma: 58 | null

    v4_prompt: NovelAIV4Prompt
    v4_negative_prompt: NovelAIV4NegativePrompt

    legacy: boolean
    legacy_v3_extend: boolean
    legacy_uc: boolean

    deliberate_euler_ancestral_bug?: boolean
}

export interface NovelAIRequest {
    action: 'generate' | 'inpaint' | 'i2i'
    model: NovelAIModel
    input: string
    parameters: NovelAIParameters
}

export interface NovelAIVibeImage {
    encodedImage: string
    strength: number
}

export interface EncodeVibeRequest {
    image: string
    information_extracted: number
    model: NovelAIModel
}
