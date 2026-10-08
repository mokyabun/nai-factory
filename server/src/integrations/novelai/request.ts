import {
    type CharacterPrompt,
    type CharacterReferenceMode,
    isNovelAIV5Model,
    type NovelAIModel,
    type NovelAINoiseSchedule,
    type NovelAISampler,
    type Parameters,
} from '@nai-factory/shared'

/** A reference image either already cached by NovelAI or uploaded with this request. */
type CachedReference = {
    cacheKey: string
    /** Present when the cache entry must be (re)created by uploading this file. */
    upload?: { fieldName: string; data: Uint8Array; contentType: string }
}

export type VibeReference = CachedReference & {
    strength: number
    informationExtracted: number
}

export type CharacterReferenceInput = CachedReference & {
    strength: number
    fidelity: number
    mode: CharacterReferenceMode
}

export type GenerationInput = {
    prompt: string
    negativePrompt: string
    characterPrompts: CharacterPrompt[]
    /** `seed` is always concrete here; 0 has already been replaced with a random value. */
    parameters: Parameters
    vibes: VibeReference[]
    characterReferences: CharacterReferenceInput[]
}

type Caption = {
    base_caption: string
    char_captions: { char_caption: string; centers: { x: number; y: number }[] }[]
}

type CachedImage = { cache_secret_key: string; data?: string }

export type NovelAIParameters = {
    params_version: number
    characterPrompts: CharacterPrompt[]
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
    normalize_reference_strength_multiple?: boolean
    reference_image_multiple_cached?: CachedImage[]
    reference_strength_multiple?: number[]
    reference_information_extracted_multiple?: number[]
    director_reference_images_cached?: CachedImage[]
    director_reference_descriptions?: {
        caption: { base_caption: string; char_captions: [] }
        legacy_uc: false
    }[]
    director_reference_information_extracted?: number[]
    director_reference_strength_values?: number[]
    director_reference_secondary_strength_values?: number[]
    autoSmea: boolean
    n_samples: number
    ucPreset: number
    controlnet_strength: number
    dynamic_thresholding: boolean
    prefer_brownian: boolean
    use_coords: boolean
    add_original_image: boolean
    inpaintImg2ImgStrength: number
    skip_cfg_above_sigma?: 58 | null
    v4_prompt: { caption: Caption; use_coords: boolean; use_order: boolean }
    v4_negative_prompt: { caption: Caption; legacy_uc: boolean }
    legacy: boolean
    legacy_v3_extend: boolean
    legacy_uc: boolean
    deliberate_euler_ancestral_bug?: boolean
}

export type NovelAIGenerateRequest = {
    action: 'generate'
    model: NovelAIModel
    input: string
    parameters: NovelAIParameters
    use_new_shared_trial: boolean
}

function cachedImage(ref: CachedReference): CachedImage {
    return ref.upload
        ? { cache_secret_key: ref.cacheKey, data: ref.upload.fieldName }
        : { cache_secret_key: ref.cacheKey }
}

export function buildGenerateRequest(input: GenerationInput): NovelAIGenerateRequest {
    const p = input.parameters
    const isV5 = isNovelAIV5Model(p.model)
    const characters = input.characterPrompts.filter((char) => char.enabled)

    if (isV5 && (input.vibes.length > 0 || input.characterReferences.length > 0)) {
        throw new Error('NovelAI V5 does not support Vibe Transfer or Character Reference')
    }

    const parameters: NovelAIParameters = {
        params_version: isV5 ? 4 : 3,
        characterPrompts: characters,
        negative_prompt: input.negativePrompt,
        width: p.width,
        height: p.height,
        qualityToggle: p.qualityToggle,
        image_format: 'png',
        steps: p.steps,
        scale: p.promptGuidance,
        seed: p.seed,
        sampler: p.sampler,
        cfg_rescale: p.promptGuidanceRescale,
        noise_schedule: isV5 ? 'karras' : p.noiseSchedule,
        v4_prompt: {
            caption: {
                base_caption: input.prompt,
                char_captions: characters.map((char) => ({
                    char_caption: char.prompt,
                    centers: [char.center],
                })),
            },
            use_coords: p.useCharacterPositions,
            use_order: true,
        },
        v4_negative_prompt: {
            caption: {
                base_caption: input.negativePrompt,
                char_captions: characters.map((char) => ({
                    char_caption: char.uc,
                    centers: [char.center],
                })),
            },
            legacy_uc: false,
        },
        use_coords: p.useCharacterPositions,
        autoSmea: false,
        n_samples: 1,
        ucPreset: 0,
        controlnet_strength: 1.0,
        dynamic_thresholding: false,
        prefer_brownian: true,
        add_original_image: true,
        inpaintImg2ImgStrength: 1,
        legacy: false,
        legacy_v3_extend: false,
        legacy_uc: false,
    }

    if (isV5) {
        parameters.deliberate_euler_ancestral_bug = false
    } else {
        parameters.skip_cfg_above_sigma = p.varietyPlus ? 58 : null
        parameters.normalize_reference_strength_multiple = p.normalizeReferenceStrengthValues
    }

    if (input.vibes.length > 0) {
        parameters.reference_image_multiple_cached = input.vibes.map(cachedImage)
        parameters.reference_information_extracted_multiple = input.vibes.map(
            (ref) => ref.informationExtracted,
        )
        parameters.reference_strength_multiple = input.vibes.map((ref) => ref.strength)
    }

    if (input.characterReferences.length > 0) {
        const refs = input.characterReferences
        parameters.director_reference_images_cached = refs.map(cachedImage)
        parameters.director_reference_descriptions = refs.map((ref) => ({
            caption: { base_caption: ref.mode, char_captions: [] },
            legacy_uc: false,
        }))
        parameters.director_reference_information_extracted = refs.map(() => 1)
        parameters.director_reference_strength_values = refs.map((ref) => ref.strength)
        parameters.director_reference_secondary_strength_values = refs.map(
            (ref) => 1 - ref.fidelity,
        )
        parameters.skip_cfg_above_sigma = null
    }

    return {
        action: 'generate',
        model: p.model,
        input: input.prompt,
        parameters,
        use_new_shared_trial: true,
    }
}
