import { unzipSync } from 'fflate'
import ky from 'ky'
import type {
    EncodeVibeRequest,
    NovelAIParameters,
    NovelAIRequest,
    NovelAIVibeImage,
    SimpleNovelAIParameters,
} from '@/types'

const NAI_BASE = 'https://image.novelai.net'
const NAI_API_BASE = 'https://api.novelai.net'

export async function encodeVibe(apiKey: string, request: EncodeVibeRequest): Promise<string> {
    const binary = await ky
        .post(`${NAI_BASE}/ai/encode-vibe`, {
            json: request,
            timeout: 60_000,
            retry: 0,
            headers: { Authorization: `Bearer ${apiKey}` },
        })
        .arrayBuffer()

    return Buffer.from(binary).toString('base64')
}

export async function generateImage(apiKey: string, params: SimpleNovelAIParameters) {
    const seed = params.seed || Math.floor(Math.random() * 2 ** 32)

    const parameters: NovelAIParameters = {
        params_version: 3,

        // Prompts
        characterPrompts: params.characterPrompts,
        negative_prompt: params.negativePrompt,

        // Image
        width: params.width,
        height: params.height,
        qualityToggle: params.qualityToggle,
        image_format: 'png',

        // AI
        steps: params.steps,
        scale: params.promptGuidance,
        seed,
        sampler: params.sampler,
        cfg_rescale: params.promptGuidanceRescale,
        noise_schedule: params.noiseSchedule,

        // V4 prompt structure
        v4_prompt: {
            caption: {
                base_caption: params.prompt,
                char_captions: params.characterPrompts.map((c) => ({
                    char_caption: c.prompt,
                    centers: [c.center],
                })),
            },
            use_coords: params.useCharacterPositions,
            use_order: true,
        },
        v4_negative_prompt: {
            caption: {
                base_caption: params.negativePrompt,
                char_captions: params.characterPrompts.map((c) => ({
                    char_caption: c.uc,
                    centers: [c.center],
                })),
            },
            legacy_uc: false,
        },

        use_coords: params.useCharacterPositions,

        // Variety Plus
        skip_cfg_above_sigma: params.varietyPlus ? 58 : null,

        // Vibe transfers
        normalize_reference_strength_multiple: params.normalizeReferenceStrengthValues,
        reference_image_multiple: params.vibeTransfers.map((v) => v.encodedImage),
        reference_strength_multiple: params.vibeTransfers.map((v) => v.strength),

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
    }

    // Add sampler-specific quirk
    if (params.sampler === 'k_euler_ancestral') {
        parameters.deliberate_euler_ancestral_bug = true
    }

    const body: NovelAIRequest = {
        input: params.prompt,
        model: params.model,
        action: 'generate',
        parameters,
    }

    const zipData = await ky
        .post(`${NAI_BASE}/ai/generate-image`, {
            json: body,
            timeout: 120_000,
            retry: {
                limit: 5,
                delay: (attempt) => 1000 * 2 ** (attempt - 1),
            },
            headers: { Authorization: `Bearer ${apiKey}` },
        })
        .arrayBuffer()

    const files = unzipSync(new Uint8Array(zipData))
    const imageEntry = Object.entries(files).find(([name]) => /\.(png|webp|jpg|jpeg)$/i.test(name))

    if (!imageEntry) {
        throw new Error('No image found in NAI API response ZIP')
    }

    return { imageData: imageEntry[1], seed }
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
    try {
        const res = await fetch(`${NAI_API_BASE}/user/subscription`, {
            headers: { Authorization: `Bearer ${apiKey}` },
        })
        return res.ok
    } catch {
        return false
    }
}
