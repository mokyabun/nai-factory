import type { NovelAIModel } from '@nai-factory/shared'
import { unzipSync } from 'fflate'

import type { Logger } from '@/logger'

import { errorFromResponse, NovelAIError } from './errors'
import { createMultipartBody, type MultipartPart } from './multipart'
import { buildGenerateRequest, type GenerationInput } from './request'

export const NOVELAI_IMAGE_URL = 'https://image.novelai.net'

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>

/** Hooks for recording outgoing requests (the debug request log). */
export type RequestRecorder = {
    begin(entry: {
        method: string
        url: string
        context: Record<string, unknown>
        request: unknown
    }): {
        success(response: unknown): void
        error(error: unknown): void
    }
}

export type NovelAIClientOptions = {
    fetch?: FetchLike
    log: Logger
    recorder?: RequestRecorder
    baseUrl?: string
    /** Retries for 429/502/503/504. Timeouts and network failures are never retried. */
    retryLimit?: number
    retryBaseDelayMs?: number
    retryMaxDelayMs?: number
    timeouts?: Partial<{ generate: number; encode: number; account: number }>
}

export type RequestOptions = {
    signal?: AbortSignal
    context?: Record<string, unknown>
}

export type AnlasStatus = { unlimited: boolean; anlas: number | null }

const DEFAULT_TIMEOUTS = { generate: 120_000, encode: 60_000, account: 10_000 }

function sleep(ms: number, signal?: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        if (signal?.aborted) return reject(signal.reason)
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort)
            resolve()
        }, ms)
        const onAbort = () => {
            clearTimeout(timer)
            reject(signal?.reason)
        }
        signal?.addEventListener('abort', onAbort, { once: true })
    })
}

export function parseRetryAfter(value: string | null, now = Date.now()) {
    if (!value) return null
    const seconds = Number(value)
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
    const date = Date.parse(value)
    return Number.isNaN(date) ? null : Math.max(0, date - now)
}

function extractImage(zip: Uint8Array) {
    let files: Record<string, Uint8Array>
    try {
        files = unzipSync(zip)
    } catch (error) {
        throw new NovelAIError(
            'server',
            `NovelAI returned an invalid archive: ${error instanceof Error ? error.message : String(error)}`,
        )
    }
    const entry = Object.entries(files).find(([name]) => /\.(png|webp|jpe?g)$/i.test(name))
    if (!entry) throw new NovelAIError('server', 'No image found in the NovelAI response')
    return entry[1]
}

export type NovelAIClient = ReturnType<typeof createNovelAIClient>

export function createNovelAIClient(options: NovelAIClientOptions) {
    const fetchImpl = options.fetch ?? ((input, init) => fetch(input, init))
    const baseUrl = options.baseUrl ?? NOVELAI_IMAGE_URL
    const retryLimit = options.retryLimit ?? 4
    const retryBaseDelayMs = options.retryBaseDelayMs ?? 1000
    const retryMaxDelayMs = options.retryMaxDelayMs ?? 30_000
    const timeouts = { ...DEFAULT_TIMEOUTS, ...options.timeouts }
    const log = options.log.child({ module: 'novelai' })

    async function attempt(
        operation: string,
        url: string,
        init: RequestInit,
        timeoutMs: number,
        signal?: AbortSignal,
    ) {
        const timeout = AbortSignal.timeout(timeoutMs)
        const combined = signal ? AbortSignal.any([signal, timeout]) : timeout
        try {
            return await fetchImpl(url, { ...init, signal: combined })
        } catch (error) {
            if (signal?.aborted) {
                throw new NovelAIError('aborted', `${operation} was cancelled`)
            }
            if (timeout.aborted) {
                throw new NovelAIError('timeout', `${operation} timed out after ${timeoutMs} ms`)
            }
            throw new NovelAIError(
                'network',
                `${operation} failed: ${error instanceof Error ? error.message : String(error)}`,
            )
        }
    }

    async function send(
        operation: string,
        path: string,
        init: RequestInit,
        timeoutMs: number,
        signal?: AbortSignal,
    ) {
        for (let retry = 0; ; retry++) {
            const response = await attempt(operation, `${baseUrl}${path}`, init, timeoutMs, signal)
            if (response.ok) return response

            const body = await response.text().catch(() => '')
            const error = errorFromResponse(operation, response.status, body)
            if (!error.retryable || retry >= retryLimit) throw error

            const delay = Math.min(
                parseRetryAfter(response.headers.get('retry-after')) ??
                    retryBaseDelayMs * 2 ** retry,
                retryMaxDelayMs,
            )
            log.warn(
                {
                    event: 'novelai.retry',
                    operation,
                    status: response.status,
                    retry: retry + 1,
                    delayMs: delay,
                },
                'Retrying NovelAI request',
            )
            try {
                await sleep(delay, signal)
            } catch {
                throw new NovelAIError('aborted', `${operation} was cancelled`)
            }
        }
    }

    async function recorded<T>(
        entry: { method: string; url: string; context: Record<string, unknown>; request: unknown },
        run: () => Promise<{ result: T; summary: unknown }>,
    ) {
        const record = options.recorder?.begin(entry)
        try {
            const { result, summary } = await run()
            record?.success(summary)
            return result
        } catch (error) {
            record?.error(error)
            throw error
        }
    }

    return {
        async generateImage(apiKey: string, input: GenerationInput, request: RequestOptions = {}) {
            const body = buildGenerateRequest(input)
            const parts: MultipartPart[] = []
            for (const ref of [...input.characterReferences, ...input.vibes]) {
                if (!ref.upload) continue
                parts.push({
                    name: ref.upload.fieldName,
                    filename: 'blob',
                    contentType: ref.upload.contentType,
                    data: ref.upload.data,
                })
            }
            parts.push({
                name: 'request',
                filename: 'blob',
                contentType: 'application/json',
                data: Buffer.from(JSON.stringify(body)),
            })
            const multipart = createMultipartBody(parts)
            const startedAt = Date.now()

            return recorded(
                {
                    method: 'POST',
                    url: `${baseUrl}/ai/generate-image`,
                    context: { ...request.context, uploadCount: parts.length - 1 },
                    request: body,
                },
                async () => {
                    const response = await send(
                        'NovelAI image generation',
                        '/ai/generate-image',
                        {
                            method: 'POST',
                            body: multipart.body,
                            headers: {
                                Authorization: `Bearer ${apiKey}`,
                                Accept: '*/*',
                                'Content-Type': multipart.contentType,
                            },
                        },
                        timeouts.generate,
                        request.signal,
                    )
                    const zip = new Uint8Array(await response.arrayBuffer())
                    const image = extractImage(zip)
                    log.debug(
                        {
                            ...request.context,
                            durationMs: Date.now() - startedAt,
                            imageBytes: image.byteLength,
                        },
                        'NovelAI image generated',
                    )
                    return {
                        result: image,
                        summary: {
                            seed: input.parameters.seed,
                            zipBytes: zip.byteLength,
                            imageBytes: image.byteLength,
                        },
                    }
                },
            )
        },

        async encodeVibe(
            apiKey: string,
            input: { image: Uint8Array; informationExtracted: number; model: NovelAIModel },
            request: RequestOptions = {},
        ) {
            const payload = {
                image: 'image',
                information_extracted: input.informationExtracted,
                model: input.model,
            }
            const multipart = createMultipartBody([
                { name: 'image', filename: 'blob', contentType: 'image/png', data: input.image },
                {
                    name: 'request',
                    filename: 'blob',
                    contentType: 'application/json',
                    data: Buffer.from(JSON.stringify(payload)),
                },
            ])

            return recorded(
                {
                    method: 'POST',
                    url: `${baseUrl}/ai/encode-vibe`,
                    context: { ...request.context },
                    request: payload,
                },
                async () => {
                    const response = await send(
                        'NovelAI vibe encoding',
                        '/ai/encode-vibe',
                        {
                            method: 'POST',
                            body: multipart.body,
                            headers: {
                                Authorization: `Bearer ${apiKey}`,
                                Accept: '*/*',
                                'Content-Type': multipart.contentType,
                            },
                        },
                        timeouts.encode,
                        request.signal,
                    )
                    const encoded = new Uint8Array(await response.arrayBuffer())
                    return { result: encoded, summary: { encodedBytes: encoded.byteLength } }
                },
            )
        },

        /** Resolves when the key is accepted; throws a NovelAIError otherwise. */
        async verifyApiKey(apiKey: string, request: RequestOptions = {}) {
            await send(
                'NovelAI API key check',
                '/user/subscription',
                { method: 'GET', headers: { Authorization: `Bearer ${apiKey}` } },
                timeouts.account,
                request.signal,
            )
        },

        async fetchAnlas(apiKey: string, request: RequestOptions = {}): Promise<AnlasStatus> {
            const response = await send(
                'NovelAI account status',
                '/user/data',
                { method: 'GET', headers: { Authorization: `Bearer ${apiKey}` } },
                timeouts.account,
                request.signal,
            )
            const data = (await response.json()) as {
                subscription?: {
                    perks?: { unlimited?: boolean }
                    trainingStepsLeft?: {
                        fixedTrainingStepsLeft?: number
                        purchasedTrainingSteps?: number
                    }
                }
            }
            const steps = data.subscription?.trainingStepsLeft
            return {
                unlimited: data.subscription?.perks?.unlimited ?? false,
                anlas:
                    steps === undefined
                        ? null
                        : Math.max(
                              0,
                              (steps.fixedTrainingStepsLeft ?? 0) +
                                  (steps.purchasedTrainingSteps ?? 0),
                          ),
            }
        },
    }
}
