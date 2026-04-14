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

export const NovelAICharacterPrompt = t.Object({
    enabled: t.Boolean(),
    center: t.Object({ x: t.Number(), y: t.Number() }),
    prompt: t.String(),
    uc: t.String(),
})
export type NovelAICharacterPrompt = typeof NovelAICharacterPrompt.static

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
    reference_image_multiple: string[]
    reference_strength_multiple: number[]

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
