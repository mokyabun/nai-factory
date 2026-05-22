import * as z from 'zod'

export const NovelAIModel = z.union([
    z.literal('nai-diffusion-4-5-full'),
    z.literal('nai-diffusion-4-5-curated'),
    z.literal('nai-diffusion-4-full'),
    z.literal('nai-diffusion-4-curated'),
])
export type NovelAIModel = z.infer<typeof NovelAIModel>

export const NovelAINoiseSchedule = z.union([
    z.literal('native'),
    z.literal('karras'),
    z.literal('exponential'),
    z.literal('polyexponential'),
])
export type NovelAINoiseSchedule = z.infer<typeof NovelAINoiseSchedule>

export const NovelAISampler = z.union([
    z.literal('k_euler_ancestral'),
    z.literal('k_euler'),
    z.literal('k_dpmpp_2s_ancestral'),
    z.literal('k_dpmpp_2m'),
    z.literal('k_dpmpp_sde'),
    z.literal('k_dpmpp_2m_sde'),
    z.literal('dimm_v3'),
])
export type NovelAISampler = z.infer<typeof NovelAISampler>

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
