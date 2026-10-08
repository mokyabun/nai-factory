import { randomBytes } from 'node:crypto'

import type {
    DebugSettings,
    EncodeVibeRequest,
    NovelAICharacterReferenceImage,
    NovelAIMode,
    NovelAIParameters,
    NovelAIRequest,
    NovelAIVibeImage,
    SimpleNovelAIParameters,
    UserData,
} from '@nai-factory/shared'
import { isNovelAIV5Model } from '@nai-factory/shared'
import { unzipSync } from 'fflate'
import type { Options } from 'ky'
import ky from 'ky'

import * as dataStorage from '@/data'
import logger from '@/logger'
import { beginDebugRequest } from '@/services/debug-log'

const log = logger.child({ module: 'novelai-service' })

type GenerateImageDebugOptions = {
    settings: DebugSettings
    context?: Record<string, unknown>
    mode?: NovelAIMode
}

export type NovelAIAnlasStatus = {
    unlimited: boolean
    anlas: number | null
}

export async function encodeVibe(apiKey: string, request: EncodeVibeRequest): Promise<string> {
    if (isNovelAIV5Model(request.model)) {
        throw new Error('NovelAI V5 does not support Vibe Transfer')
    }
    const startedAt = Date.now()
    log.debug(
        { model: request.model, informationExtracted: request.information_extracted },
        'Encoding vibe image',
    )
    const imageBytes = Buffer.from(request.image, 'base64')
    const multipart = createMultipartBody([
        {
            name: 'image',
            filename: request.imageFilename ?? 'blob',
            contentType: request.imageContentType ?? 'image/png',
            data: imageBytes,
        },
        {
            name: 'request',
            filename: 'blob',
            contentType: 'application/json',
            data: Buffer.from(
                JSON.stringify({
                    image: 'image',
                    information_extracted: request.information_extracted,
                    model: request.model,
                }),
            ),
        },
    ])

    const binary = await postNovelAIArrayBuffer('https://image.novelai.net/ai/encode-vibe', {
        body: multipart.body,
        timeout: 60_000,
        retry: 0,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: '*/*',
            'Cache-Control': 'no-cache',
            'Content-Type': multipart.contentType,
            Pragma: 'no-cache',
        },
        errorPrefix: 'NovelAI vibe encoding failed',
    })

    const encoded = Buffer.from(binary).toString('base64')
    log.debug(
        {
            model: request.model,
            informationExtracted: request.information_extracted,
            durationMs: Date.now() - startedAt,
        },
        'Vibe image encoded',
    )

    return encoded
}

type NovelAIPostOptions = {
    errorPrefix: string
} & Pick<Options, 'body' | 'headers' | 'json' | 'retry' | 'timeout'>

async function postNovelAIArrayBuffer(url: string, options: NovelAIPostOptions) {
    try {
        return await ky
            .post(url, {
                body: options.body,
                json: options.json,
                timeout: options.timeout,
                retry: options.retry,
                headers: options.headers,
            })
            .arrayBuffer()
    } catch (error) {
        if (error instanceof Error && 'response' in error) {
            const response = error.response as Response | undefined
            const text = await response?.text().catch(() => '')
            if (response) {
                throw new Error(
                    `${options.errorPrefix} (${response.status}): ${text?.slice(0, 500) || error.message}`,
                )
            }
        }

        throw error
    }
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

type MultipartPart = {
    name: string
    filename: string
    contentType: string
    data: Uint8Array
}

function createMultipartBody(parts: MultipartPart[]) {
    const boundary = `----WebKitFormBoundary${randomBytes(12).toString('base64url')}`
    const chunks: Buffer[] = []

    for (const part of parts) {
        chunks.push(
            Buffer.from(
                [
                    `--${boundary}`,
                    `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"`,
                    `Content-Type: ${part.contentType}`,
                    '',
                    '',
                ].join('\r\n'),
            ),
            Buffer.from(part.data),
            Buffer.from('\r\n'),
        )
    }

    chunks.push(Buffer.from(`--${boundary}--\r\n`))

    return {
        body: Buffer.concat(chunks),
        contentType: `multipart/form-data; boundary=${boundary}`,
    }
}

function getUploadRefs(params: SimpleNovelAIParameters) {
    const vibes = (params.vibeTransfers ?? []).filter(
        (ref): ref is NovelAIVibeImage & { uploadFieldName: string; encodedBytes: Uint8Array } =>
            !!ref.uploadFieldName && !!ref.encodedBytes,
    )
    const characterReferences = (params.characterReferences ?? []).filter(
        (
            ref,
        ): ref is NovelAICharacterReferenceImage & { uploadFieldName: string; filePath: string } =>
            !!ref.uploadFieldName && !!ref.filePath,
    )

    return { vibes, characterReferences }
}

type UploadRefs = ReturnType<typeof getUploadRefs>

function createGenerateImageRequest(params: SimpleNovelAIParameters, seed: number): NovelAIRequest {
    const isV5 = isNovelAIV5Model(params.model)
    const enabledChars = params.characterPrompts.filter((c) => c.enabled)
    const vibeTransfers = params.vibeTransfers ?? []
    const characterReferences = params.characterReferences ?? []

    if (isV5 && (vibeTransfers.length > 0 || characterReferences.length > 0)) {
        throw new Error('NovelAI V5 does not support Vibe Transfer or Character Reference')
    }

    const parameters: NovelAIParameters = {
        params_version: isV5 ? 4 : 3,

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
        noise_schedule: isV5 ? 'karras' : params.noiseSchedule,

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

    if (isV5) {
        delete parameters.skip_cfg_above_sigma
        delete parameters.normalize_reference_strength_multiple
        parameters.deliberate_euler_ancestral_bug = false
    }

    if (vibeTransfers.length > 0) {
        parameters.reference_image_multiple_cached = vibeTransfers.map((ref) =>
            cachedRef(ref.cacheSecretKey, ref.uploadFieldName),
        )
        parameters.reference_information_extracted_multiple = vibeTransfers.map(
            (ref) => ref.informationExtracted ?? 1,
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

    return {
        input: params.prompt,
        model: params.model,
        action: 'generate',
        parameters: parameters,
        use_new_shared_trial: true,
    }
}

async function postGenerateImageRequest(
    apiKey: string,
    body: NovelAIRequest,
    uploadRefs: UploadRefs,
    shouldUseMultipart: boolean,
) {
    if (shouldUseMultipart) {
        const parts: MultipartPart[] = []

        for (const ref of uploadRefs.characterReferences) {
            if (!(await dataStorage.exists(ref.filePath))) {
                throw new Error(`Reference image not found: ${ref.filePath}`)
            }
            parts.push({
                name: ref.uploadFieldName,
                filename: 'blob',
                contentType: getMimeType(ref.filePath),
                data: await dataStorage.readFile(ref.filePath),
            })
        }
        for (const ref of uploadRefs.vibes) {
            parts.push({
                name: ref.uploadFieldName,
                filename: 'blob',
                contentType: 'image/png',
                data: ref.encodedBytes,
            })
        }

        parts.push({
            name: 'request',
            filename: 'blob',
            contentType: 'application/json',
            data: Buffer.from(JSON.stringify(body)),
        })

        const multipart = createMultipartBody(parts)

        return postNovelAIArrayBuffer('https://image.novelai.net/ai/generate-image', {
            body: multipart.body,
            timeout: 120_000,
            retry: {
                limit: 5,
                delay: (attempt) => 1000 * 2 ** (attempt - 1),
            },
            headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: '*/*',
                'Cache-Control': 'no-cache',
                'Content-Type': multipart.contentType,
                Pragma: 'no-cache',
            },
            errorPrefix: 'NovelAI image generation failed',
        })
    }

    return postNovelAIArrayBuffer('https://image.novelai.net/ai/generate-image', {
        json: body,
        timeout: 120_000,
        retry: {
            limit: 5,
            delay: (attempt) => 1000 * 2 ** (attempt - 1),
        },
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
        errorPrefix: 'NovelAI image generation failed',
    })
}

function extractImageFromZip(zipData: ArrayBuffer) {
    const files = unzipSync(new Uint8Array(zipData))

    if (Object.keys(files).length === 0) {
        throw new Error('NAI API response zip is empty')
    }

    const imageEntry = Object.entries(files).find(([name]) => /\.(png|webp|jpg|jpeg)$/i.test(name))

    if (!imageEntry) {
        throw new Error('No image found in NAI API response ZIP')
    }

    return { name: imageEntry[0], data: imageEntry[1] }
}

export async function generateImage(
    apiKey: string,
    params: SimpleNovelAIParameters,
    debug?: GenerateImageDebugOptions,
) {
    const seed = params.seed ?? Math.floor(Math.random() * 2 ** 32)
    const mode = debug?.mode ?? 'live'

    if (mode === 'fail') {
        throw new Error('NovelAI test failure mode is enabled')
    }

    if (mode === 'mock') {
        log.debug(
            {
                model: params.model,
                seed,
                width: params.width,
                height: params.height,
                ...debug?.context,
            },
            'NovelAI mock image generated',
        )
        return { imageData: createMockImage(params, seed), seed }
    }

    const body = createGenerateImageRequest(params, seed)

    const uploadRefs = getUploadRefs(params)
    const vibeTransfers = params.vibeTransfers ?? []
    const characterReferences = params.characterReferences ?? []
    const shouldUseMultipart = true
    const startedAt = Date.now()
    log.debug(
        {
            model: params.model,
            seed,
            width: params.width,
            height: params.height,
            steps: params.steps,
            sampler: params.sampler,
            noiseSchedule: params.noiseSchedule,
            characterPromptCount: body.parameters.characterPrompts.length,
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

    try {
        const zipData = await postGenerateImageRequest(apiKey, body, uploadRefs, shouldUseMultipart)
        const image = extractImageFromZip(zipData)

        debugRequest?.success({
            seed,
            zipBytes: zipData.byteLength,
            imageName: image.name,
            imageBytes: image.data.byteLength,
        })
        log.debug(
            {
                seed,
                zipBytes: zipData.byteLength,
                imageBytes: image.data.byteLength,
                durationMs: Date.now() - startedAt,
                ...debug?.context,
            },
            'NovelAI image request completed',
        )

        return { imageData: image.data, seed }
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
        const res = await fetch('https://image.novelai.net/user/subscription', {
            headers: { Authorization: `Bearer ${apiKey}` },
        })
        log.debug({ ok: res.ok, status: res.status }, 'NovelAI API key validation completed')
        return res.ok
    } catch {
        log.warn(
            { event: 'novelai.api_key_validation.failed' },
            'NovelAI API key validation failed',
        )
        return false
    }
}

async function readNovelAIError(res: Response) {
    const text = await res.text().catch(() => '')
    if (!text) return `NovelAI account status failed (${res.status})`

    try {
        const data = JSON.parse(text) as { message?: unknown; error?: unknown }
        const message = typeof data.message === 'string' ? data.message : data.error
        if (typeof message === 'string') {
            return `NovelAI account status failed (${res.status}): ${message}`
        }
    } catch {
        // Fall through to the raw response text.
    }

    return `NovelAI account status failed (${res.status}): ${text.slice(0, 200)}`
}

export async function fetchAnlasStatus(apiKey: string): Promise<NovelAIAnlasStatus> {
    const res = await fetch('https://image.novelai.net/user/data', {
        headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) throw new Error(await readNovelAIError(res))

    const data = (await res.json()) as Partial<UserData>
    const unlimited = data.subscription?.perks?.unlimited ?? false
    const trainingStepsLeft = data.subscription?.trainingStepsLeft
    const anlas =
        trainingStepsLeft !== undefined
            ? Math.max(
                  0,
                  (trainingStepsLeft.fixedTrainingStepsLeft ?? 0) +
                      (trainingStepsLeft.purchasedTrainingSteps ?? 0),
              )
            : null

    return { unlimited, anlas }
}

function createMockImage(params: SimpleNovelAIParameters, seed: number) {
    const width = Math.max(64, params.width || 512)
    const height = Math.max(64, params.height || 512)
    const prompt = escapeXml(params.prompt.slice(0, 160) || 'Mock NovelAI image')
    const model = escapeXml(params.model)

    return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f4f4f5"/>
      <stop offset="1" stop-color="#d4d4d8"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="24" y="24" width="${width - 48}" height="${height - 48}" fill="none" stroke="#71717a" stroke-width="2" stroke-dasharray="8 8"/>
  <text x="40" y="64" fill="#18181b" font-family="Menlo, monospace" font-size="24" font-weight="700">NovelAI Mock</text>
  <text x="40" y="104" fill="#3f3f46" font-family="Menlo, monospace" font-size="16">seed ${seed}</text>
  <text x="40" y="132" fill="#3f3f46" font-family="Menlo, monospace" font-size="16">${model}</text>
  <foreignObject x="40" y="168" width="${width - 80}" height="${height - 208}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font: 18px sans-serif; color: #27272a; line-height: 1.45; word-break: break-word;">${prompt}</div>
  </foreignObject>
</svg>`)
}

function escapeXml(value: string) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;')
}
