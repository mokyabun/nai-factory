import * as z from 'zod'

/** Novel AI Model */
export const NOVEL_AI_MODELS = [
    'nai-diffusion-4-5-full',
    'nai-diffusion-4-5-curated',
    'nai-diffusion-4-full',
    'nai-diffusion-4-curated',
] as const

export const NovelAIModel = z.enum(NOVEL_AI_MODELS)
export type NovelAIModel = z.infer<typeof NovelAIModel>

export const NOVEL_AI_MODEL_OPTIONS = [
    { label: 'NAI Diffusion 4.5 Full', value: 'nai-diffusion-4-5-full' },
    { label: 'NAI Diffusion 4.5 Curated', value: 'nai-diffusion-4-5-curated' },
    { label: 'NAI Diffusion 4 Full', value: 'nai-diffusion-4-full' },
    { label: 'NAI Diffusion 4 Curated', value: 'nai-diffusion-4-curated' },
] as const satisfies readonly { label: string; value: NovelAIModel }[]

/** Noise Schedule */
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

/** Sampler */
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
    characterReferences: NovelAICharacterReferenceImage[]

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

    /** Prompts */
    characterPrompts: NovelAICharacterPrompt[]
    negative_prompt: string

    /** Image Generation Settings */
    width: number
    height: number

    qualityToggle: boolean
    image_format: 'png'

    /** AI Settings */
    steps: number
    scale: number
    seed: number
    sampler: NovelAISampler
    cfg_rescale: number
    noise_schedule: NovelAINoiseSchedule

    /** Vibe Transfer */
    normalize_reference_strength_multiple: boolean
    reference_image_multiple?: string[]
    reference_image_multiple_cached?: NovelAICachedImage[]
    reference_strength_multiple?: number[]
    reference_information_extracted_multiple?: number[]

    /** Character Reference */
    director_reference_images_cached?: NovelAICachedImage[]
    director_reference_descriptions?: Array<{
        caption: {
            base_caption: string
            char_captions: []
        }
        legacy_uc: false
    }>
    director_reference_information_extracted?: number[]
    director_reference_strength_values?: number[]
    director_reference_secondary_strength_values?: number[]

    /** miscellaneous */
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
    use_new_shared_trial?: boolean
}

export interface NovelAICachedImage {
    cache_secret_key: string
    data?: string
}

export interface NovelAIVibeImage {
    id?: number
    cacheSecretKey: string
    uploadFieldName?: string
    filePath?: string
    strength: number
}

export interface NovelAICharacterReferenceImage {
    id?: number
    cacheSecretKey: string
    uploadFieldName?: string
    filePath?: string
    strength: number
    fidelity: number
    mode: string
}

export interface EncodeVibeRequest {
    image: string
    information_extracted: number
    model: NovelAIModel
}

export interface UserData {
    priority: {
        maxPriorityActions: number
        nextRefillAt: number
        taskPriority: number
    }
    subscription: {
        tier: number
        active: boolean
        paymentProcessor: number
        expiresAt: number
        perks: {
            maxPriorityActions: number
            startPriority: number
            moduleTrainingSteps: number
            unlimitedMaxPriority: boolean
            voiceGeneration: boolean
            imageGeneration: boolean
            unlimited: boolean
            unlimitedLimits: {
                resolution: number
                maxPrompts: number
            }[]
            contextTokens: number
        }
        paymentProcessorData: {
            r: string
            s: string
            t: number
            plan_id: string
            next_billing_at: number
        }
        trainingStepsLeft: {
            fixedTrainingStepsLeft: number
            purchasedTrainingSteps: number
        }
        accountType: number
        isGracePeriod: boolean
    }
    keystore: {
        keystore: string | null
        changeIndex: number
    }
    settings: string | null
    information: {
        emailVerified: boolean
        emailVerificationLetterSent: boolean
        hasPlaintextEmail: boolean
        plainTextEmail: string | null
        allowMarketingEmails: boolean
        trialActivated: boolean
        trialActionsLeft: number
        trialImagesLeft: number
        accountCreatedAt: number
        banStatus: 'not_banned' | 'banned' | 'permanently_banned'
        banMessage: string
    }
}
