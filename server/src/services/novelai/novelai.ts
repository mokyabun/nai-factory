import type {
    DebugSettings,
    EncodeVibeRequest,
    NovelAICharacterReferenceImage,
    NovelAIParameters,
    NovelAIRequest,
    NovelAIVibeImage,
    SimpleNovelAIParameters,
} from '@nai-factory/shared'
import { unzipSync } from 'fflate'
import ky from 'ky'
import logger from '#/logger'
import { beginDebugRequest } from '#/services/debug-log'

const log = logger.child({ module: 'novelai-service' })

type GenerateImageDebugOptions = {
    settings: DebugSettings
    context?: Record<string, unknown>
}

export async function encodeVibe(apiKey: string, request: EncodeVibeRequest): Promise<string> {
    const startedAt = Date.now()
    log.debug(
        { model: request.model, informationExtracted: request.information_extracted },
        'Encoding vibe image',
    )
    const form = new FormData()
    const imageBytes = Buffer.from(request.image, 'base64')

    form.append('image', new Blob([imageBytes], { type: 'image/png' }), 'blob')
    form.append(
        'request',
        new Blob(
            [
                JSON.stringify({
                    information_extracted: request.information_extracted,
                    model: request.model,
                }),
            ],
            { type: 'application/json' },
        ),
        'blob',
    )

    const binary = await ky
        .post('https://image.novelai.net/ai/encode-vibe', {
            body: form,
            timeout: 60_000,
            retry: 0,
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
        })
        .arrayBuffer()

    const encoded = Buffer.from(binary).toString('base64')
    log.info(
        {
            model: request.model,
            informationExtracted: request.information_extracted,
            durationMs: Date.now() - startedAt,
        },
        'Vibe image encoded',
    )

    return encoded
}

function getMimeType(path: string) {
    const lower = path.toLowerCase()
    if (lower.endsWith('.png')) return 'image/png'
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
    if (lower.endsWith('.webp')) return 'image/webp'
    return 'application/octet-stream'
}

function cachedRef(cacheSecretKey: string, uploadFieldName?: string) {
    return uploadFieldName
        ? { cache_secret_key: cacheSecretKey, data: uploadFieldName }
        : { cache_secret_key: cacheSecretKey }
}

async function appendUploadPart(form: FormData, fieldName: string, filePath: string) {
    const file = Bun.file(filePath)
    if (!(await file.exists())) throw new Error(`Reference image not found: ${filePath}`)

    form.append(
        fieldName,
        new Blob([await file.arrayBuffer()], {
            type: file.type || getMimeType(filePath),
        }),
        'blob',
    )
}

function getUploadRefs(params: SimpleNovelAIParameters) {
    const vibes = (params.vibeTransfers ?? []).filter(
        (ref): ref is NovelAIVibeImage & { uploadFieldName: string; filePath: string } =>
            !!ref.uploadFieldName && !!ref.filePath,
    )
    const characterReferences = (params.characterReferences ?? []).filter(
        (
            ref,
        ): ref is NovelAICharacterReferenceImage & { uploadFieldName: string; filePath: string } =>
            !!ref.uploadFieldName && !!ref.filePath,
    )

    return { vibes, characterReferences }
}

export async function generateImage(
    apiKey: string,
    params: SimpleNovelAIParameters,
    debug?: GenerateImageDebugOptions,
) {
    const seed = params.seed ?? Math.floor(Math.random() * 2 ** 32)
    const enabledChars = params.characterPrompts.filter((c) => c.enabled)
    const vibeTransfers = params.vibeTransfers ?? []
    const characterReferences = params.characterReferences ?? []

    const parameters: NovelAIParameters = {
        params_version: 3,

        // Prompts
        characterPrompts: enabledChars,
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
                char_captions: enabledChars.map((char) => ({
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
                char_captions: enabledChars.map((char) => ({
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

        // Vibe Transfer
        normalize_reference_strength_multiple: params.normalizeReferenceStrengthValues,

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

    if (vibeTransfers.length > 0) {
        parameters.reference_image_multiple_cached = vibeTransfers.map((ref) =>
            cachedRef(ref.cacheSecretKey, ref.uploadFieldName),
        )
        parameters.reference_strength_multiple = vibeTransfers.map((ref) => ref.strength)
    }

    if (characterReferences.length > 0) {
        parameters.director_reference_images_cached = characterReferences.map((ref) =>
            cachedRef(ref.cacheSecretKey, ref.uploadFieldName),
        )
        parameters.director_reference_descriptions = characterReferences.map((ref) => ({
            caption: {
                base_caption: ref.mode,
                char_captions: [],
            },
            legacy_uc: false,
        }))
        parameters.director_reference_information_extracted = characterReferences.map(() => 1)
        parameters.director_reference_strength_values = characterReferences.map(
            (ref) => ref.strength,
        )
        parameters.director_reference_secondary_strength_values = characterReferences.map(
            (ref) => 1 - ref.fidelity,
        )
        parameters.skip_cfg_above_sigma = null
    }

    const body: NovelAIRequest = {
        input: params.prompt,
        model: params.model,
        action: 'generate',
        parameters: parameters,
        use_new_shared_trial: true,
    }

    const uploadRefs = getUploadRefs(params)
    const shouldUseMultipart = vibeTransfers.length > 0 || characterReferences.length > 0
    const startedAt = Date.now()
    log.info(
        {
            model: params.model,
            seed,
            width: params.width,
            height: params.height,
            steps: params.steps,
            sampler: params.sampler,
            noiseSchedule: params.noiseSchedule,
            characterPromptCount: enabledChars.length,
            vibeTransferCount: vibeTransfers.length,
            characterReferenceCount: characterReferences.length,
            multipart: shouldUseMultipart,
            uploadCount: uploadRefs.characterReferences.length + uploadRefs.vibes.length,
            ...debug?.context,
        },
        'NovelAI image request started',
    )
    const debugRequest = beginDebugRequest({
        settings: debug?.settings ?? { enabled: false, recentRequestLimit: 20 },
        method: 'POST',
        url: 'https://image.novelai.net/ai/generate-image',
        context: {
            multipart: shouldUseMultipart,
            uploadCount: uploadRefs.characterReferences.length + uploadRefs.vibes.length,
            ...debug?.context,
        },
        request: body,
    })
    let zipData: ArrayBuffer

    try {
        if (shouldUseMultipart) {
            const form = new FormData()

            for (const ref of uploadRefs.characterReferences) {
                await appendUploadPart(form, ref.uploadFieldName, ref.filePath)
            }
            for (const ref of uploadRefs.vibes) {
                await appendUploadPart(form, ref.uploadFieldName, ref.filePath)
            }

            form.append(
                'request',
                new Blob([JSON.stringify(body)], { type: 'application/json' }),
                'blob',
            )

            zipData = await ky
                .post('https://image.novelai.net/ai/generate-image', {
                    body: form,
                    timeout: 120_000,
                    retry: {
                        limit: 5,
                        delay: (attempt) => 1000 * 2 ** (attempt - 1),
                    },
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        Accept: '*/*',
                        'Cache-Control': 'no-cache',
                        Pragma: 'no-cache',
                    },
                })
                .arrayBuffer()
        } else {
            zipData = await ky
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
        }

        const zipUint8 = new Uint8Array(zipData)
        const files = unzipSync(zipUint8)

        if (Object.keys(files).length === 0) {
            throw new Error('NAI API response zip is empty')
        }

        const imageEntry = Object.entries(files).find(([name]) =>
            /\.(png|webp|jpg|jpeg)$/i.test(name),
        )

        if (!imageEntry) {
            throw new Error('No image found in NAI API response ZIP')
        }

        debugRequest?.success({
            seed,
            zipBytes: zipData.byteLength,
            imageName: imageEntry[0],
            imageBytes: imageEntry[1].byteLength,
        })
        log.info(
            {
                seed,
                zipBytes: zipData.byteLength,
                imageBytes: imageEntry[1].byteLength,
                durationMs: Date.now() - startedAt,
                ...debug?.context,
            },
            'NovelAI image request completed',
        )

        return { imageData: imageEntry[1], seed }
    } catch (error) {
        debugRequest?.error(error)
        log.error(
            {
                seed,
                durationMs: Date.now() - startedAt,
                ...debug?.context,
                err: error,
            },
            'NovelAI image request failed',
        )
        throw error
    }
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
    try {
        const res = await fetch('https://api.novelai.net/user/subscription', {
            headers: { Authorization: `Bearer ${apiKey}` },
        })
        log.debug({ ok: res.ok, status: res.status }, 'NovelAI API key validation completed')
        return res.ok
    } catch {
        log.warn('NovelAI API key validation failed')
        return false
    }
}
