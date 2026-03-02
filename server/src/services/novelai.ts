import { unzipSync } from 'fflate'
import type {
    EncodeVibeRequest,
    NovelAIParameters,
    NovelAIRequest,
    SimpleNovelAIParameters,
} from '@/types'
import ky from 'ky'

export async function encodeVibe(apiKey: string, request: EncodeVibeRequest): Promise<string> {
    const binary = await ky
        .post('https://image.novelai.net/ai/encode-vibe', {
            json: request,
            timeout: 60_000,
            retry: 0,
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
        })
        .arrayBuffer()

    const base64 = Buffer.from(binary).toString('base64')

    return base64
}

export async function generateImage(apiKey: string, params: SimpleNovelAIParameters) {
    const seed = params.seed ?? Math.floor(Math.random() * 2 ** 32)

    const parameters: NovelAIParameters = {
        params_version: 3,

        // Prompts
        characterPrompts: params.characterPrompts,
        negative_prompt: params.negativePrompt,

        // Image Generation Settings
        width: params.width,
        height: params.height,
        qualityToggle: params.qualityToggle,
        image_format: 'png',

        // AI Settings
        steps: params.steps,
        scale: params.promptGuidance,
        seed: seed,
        sampler: params.sampler,
        cfg_rescale: params.promptGuidanceRescale,
        noise_schedule: params.noiseSchedule,

        v4_prompt: {
            caption: {
                base_caption: params.prompt,
                char_captions: params.characterPrompts.map((char) => ({
                    char_caption: char.prompt,
                    centers: [char.center],
                })),
            },
            use_coords: params.useCharacterPositions,
            use_order: true,
        },
        v4_negative_prompt: {
            caption: {
                base_caption: params.negativePrompt,
                char_captions: params.characterPrompts.map((char) => ({
                    char_caption: char.uc,
                    centers: [char.center],
                })),
            },
            legacy_uc: false,
        },

        // Character positions
        use_coords: params.useCharacterPositions,

        // Variety Plus
        skip_cfg_above_sigma: params.varietyPlus ? 58 : null,

        // Misc
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

        // TODO: implement vibe transfer settings
        normalize_reference_strength_multiple: params.normalizeReferenceStrengthValues,
        reference_image_multiple: [],
        reference_strength_multiple: [],

        // TODO: implement character reference settings
    }

    const body: NovelAIRequest = {
        input: params.prompt,
        model: params.model,
        action: 'generate',
        parameters: parameters,
    }

    // retry 5 times with exponential backoff starting at 1s
    const zipData = await ky
        .post('https://image.novelai.net/ai/generate-image', {
            json: body,
            timeout: 120_000,
            retry: {
                limit: 5,
                delay: (attempt) => 1000 * 2 ** (attempt - 1),
            },
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
        })
        .arrayBuffer()

    const zipUint8 = new Uint8Array(zipData)
    const files = unzipSync(zipUint8)

    if (Object.keys(files).length === 0) {
        throw new Error('NAI API response zip is empty')
    }

    const imageEntry = Object.entries(files).find(([name]) => /\.(png|webp|jpg|jpeg)$/i.test(name))

    if (!imageEntry) {
        throw new Error('No image found in NAI API response ZIP')
    }

    return { imageData: imageEntry[1], seed }
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
    try {
        const res = await fetch('https://api.novelai.net/user/subscription', {
            headers: { Authorization: `Bearer ${apiKey}` },
        })
        return res.ok
    } catch {
        return false
    }
}
