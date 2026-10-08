import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { SimpleNovelAIParameters } from '@nai-factory/shared'
import {
    DEFAULT_PROJECT_PARAMETERS,
    NOVEL_AI_MODELS,
    Parameters,
    PlaygroundEnqueueBody,
    ProjectPatchBody,
} from '@nai-factory/shared'
import { zipSync } from 'fflate'

type KyPostOptions = {
    json?: unknown
    body?: unknown
    headers?: Record<string, string>
}

const arrayBufferMock = mock(() => Promise.resolve(new ArrayBuffer(0)))
const postMock = mock((_url: string, _options?: KyPostOptions) => ({
    arrayBuffer: arrayBufferMock,
}))

await mock.module('ky', () => ({
    default: { post: postMock },
}))

const { encodeVibe, fetchAnlasStatus, generateImage } = await import('../../src/services/novelai')

function makeZip(entries: Record<string, Uint8Array>) {
    return (zipSync(entries) as Uint8Array).buffer as ArrayBuffer
}

const pngZip = makeZip({ 'image.png': new Uint8Array([1, 2, 3]) })
const tempImagePath = join(import.meta.dir, 'ref.png')

const baseParams: SimpleNovelAIParameters = {
    prompt: 'a cat',
    negativePrompt: 'bad',
    characterPrompts: [],
    vibeTransfers: [],
    characterReferences: [],
    model: 'nai-diffusion-4-5-full',
    width: 512,
    height: 512,
    steps: 28,
    promptGuidance: 6,
    varietyPlus: false,
    seed: 12345,
    sampler: 'k_euler',
    promptGuidanceRescale: 0,
    noiseSchedule: 'native',
    normalizeReferenceStrengthValues: false,
    useCharacterPositions: false,
    qualityToggle: true,
}

function getMultipartText(options: KyPostOptions) {
    if (!(options.body instanceof Uint8Array)) throw new Error('Expected multipart byte body')
    return Buffer.from(options.body).toString('utf8')
}

function getMultipartPartNames(options: KyPostOptions) {
    return [
        ...getMultipartText(options).matchAll(/Content-Disposition: form-data; name="([^"]+)"/g),
    ]
        .map((match) => match[1])
        .filter((name): name is string => name !== undefined)
}

function getRequestFromMultipart(options: KyPostOptions) {
    const text = getMultipartText(options)
    expect(text).toContain('Content-Type: application/json\r\n')

    const match = text.match(
        /Content-Disposition: form-data; name="request"; filename="blob"\r\nContent-Type: application\/json\r\n\r\n([\s\S]*?)\r\n------WebKitFormBoundary/,
    )
    if (!match?.[1]) throw new Error('Expected multipart request part')
    return JSON.parse(match[1])
}

function getPostOptions() {
    const options = postMock.mock.calls[0]?.[1]
    if (!options) throw new Error('Expected ky.post options')
    return options
}

describe('NovelAI cached reference requests', () => {
    beforeEach(async () => {
        postMock.mockClear()
        arrayBufferMock.mockClear()
        arrayBufferMock.mockImplementation(() => Promise.resolve(pngZip))
        await writeFile(tempImagePath, new Uint8Array([137, 80, 78, 71]))
    })

    afterEach(async () => {
        await rm(tempImagePath, { force: true })
    })

    it('uses multipart request parts for generation without cached references', async () => {
        await generateImage('key', baseParams)

        expect(postMock.mock.calls[0]?.[0]).toBe('https://image.novelai.net/ai/generate-image')
        const options = getPostOptions()
        expect(options.body).toBeInstanceOf(Uint8Array)
        expect(options.headers?.['Content-Type']).toMatch(
            /^multipart\/form-data; boundary=----WebKitFormBoundary/,
        )
        expect(getMultipartPartNames(options)).toEqual(['request'])

        const request = getRequestFromMultipart(options)
        expect(request.parameters).not.toHaveProperty('reference_image_multiple_cached')
    })

    for (const model of ['nai-diffusion-5-full', 'nai-diffusion-5-curated'] as const) {
        it(`generates with ${model} using V5 parameters and character prompts`, async () => {
            const character = {
                enabled: true,
                center: { x: 0.35, y: 0.7 },
                prompt: 'a girl',
                uc: 'bad hands',
            }
            await generateImage('key', {
                ...baseParams,
                model,
                prompt: '공원에서 고양이와 소녀',
                characterPrompts: [character, { ...character, enabled: false }],
                useCharacterPositions: true,
                varietyPlus: true,
                noiseSchedule: 'exponential',
            })

            const options = getPostOptions()
            expect(getMultipartPartNames(options)).toEqual(['request'])
            const request = getRequestFromMultipart(options)
            expect(request).toMatchObject({
                model,
                action: 'generate',
                input: '공원에서 고양이와 소녀',
                parameters: {
                    params_version: 4,
                    noise_schedule: 'karras',
                    seed: 12345,
                    sampler: 'k_euler',
                    deliberate_euler_ancestral_bug: false,
                    characterPrompts: [character],
                    v4_prompt: {
                        caption: {
                            base_caption: '공원에서 고양이와 소녀',
                            char_captions: [
                                { char_caption: 'a girl', centers: [character.center] },
                            ],
                        },
                        use_coords: true,
                    },
                    v4_negative_prompt: {
                        caption: {
                            char_captions: [
                                { char_caption: 'bad hands', centers: [character.center] },
                            ],
                        },
                    },
                },
            })
            expect(request.parameters).not.toHaveProperty('skip_cfg_above_sigma')
            expect(request.parameters).not.toHaveProperty('normalize_reference_strength_multiple')
            expect(request.parameters).not.toHaveProperty('reference_image_multiple_cached')
            expect(request.parameters).not.toHaveProperty('director_reference_images_cached')
        })
    }

    it('preserves V4.5 noise schedule and Variety+ settings', async () => {
        await generateImage('key', {
            ...baseParams,
            varietyPlus: true,
            noiseSchedule: 'exponential',
        })
        expect(getRequestFromMultipart(getPostOptions()).parameters).toMatchObject({
            params_version: 3,
            noise_schedule: 'exponential',
            skip_cfg_above_sigma: 58,
        })
    })

    it('rejects unsupported V5 references before posting', async () => {
        // eslint-disable-next-line typescript/await-thenable -- Bun async resolves/rejects matchers are awaited even though their types return void.
        await expect(
            generateImage('key', {
                ...baseParams,
                model: 'nai-diffusion-5-full',
                vibeTransfers: [{ cacheSecretKey: 'vibe-key', strength: 0.6 }],
            }),
        ).rejects.toThrow('NovelAI V5 does not support Vibe Transfer or Character Reference')
        expect(postMock).not.toHaveBeenCalled()
    })

    it('uploads character references as director_ref parts before request', async () => {
        await generateImage('key', {
            ...baseParams,
            characterReferences: [
                {
                    id: 1,
                    cacheSecretKey: 'character-key',
                    uploadFieldName: 'director_ref_0',
                    filePath: tempImagePath,
                    strength: 0.8,
                    fidelity: 0.6,
                    mode: 'character&style',
                },
            ],
        })

        const options = getPostOptions()
        expect(getMultipartPartNames(options)).toEqual(['director_ref_0', 'request'])

        const request = getRequestFromMultipart(options)
        expect(request.parameters.director_reference_images_cached).toEqual([
            { cache_secret_key: 'character-key', data: 'director_ref_0' },
        ])
        expect(request.parameters.director_reference_secondary_strength_values).toEqual([0.4])
        expect(request.parameters.skip_cfg_above_sigma).toBeNull()
    })

    it('reuses cached character reference keys without data fields', async () => {
        await generateImage('key', {
            ...baseParams,
            characterReferences: [
                {
                    id: 1,
                    cacheSecretKey: 'character-key',
                    strength: 0.8,
                    fidelity: 0.6,
                    mode: 'character',
                },
            ],
        })

        const options = getPostOptions()
        expect(getMultipartPartNames(options)).toEqual(['request'])

        const request = getRequestFromMultipart(options)
        expect(request.parameters.director_reference_images_cached).toEqual([
            { cache_secret_key: 'character-key' },
        ])
    })

    it('uploads vibe references as ref_multiple parts before request', async () => {
        await generateImage('key', {
            ...baseParams,
            vibeTransfers: [
                {
                    id: 1,
                    cacheSecretKey: 'vibe-key',
                    uploadFieldName: 'ref_multiple_0',
                    encodedBytes: new Uint8Array([1, 2, 3, 4]),
                    strength: 0.6,
                },
            ],
        })

        const options = getPostOptions()
        expect(getMultipartPartNames(options)).toEqual(['ref_multiple_0', 'request'])
        expect(getMultipartText(options)).toContain(
            'Content-Disposition: form-data; name="ref_multiple_0"; filename="blob"\r\nContent-Type: image/png\r\n',
        )
        expect(getMultipartText(options)).toContain('\r\n\r\n\x01\x02\x03\x04\r\n')

        const request = getRequestFromMultipart(options)
        expect(request.parameters.reference_image_multiple_cached).toEqual([
            { cache_secret_key: 'vibe-key', data: 'ref_multiple_0' },
        ])
        expect(request.parameters.reference_information_extracted_multiple).toEqual([1])
        expect(request.parameters.reference_strength_multiple).toEqual([0.6])
    })

    it('uses cached vibe parameters even when encoded data exists', async () => {
        await generateImage('key', {
            ...baseParams,
            vibeTransfers: [
                {
                    id: 1,
                    cacheSecretKey: 'vibe-key',
                    encodedBytes: new Uint8Array([1, 2, 3, 4]),
                    informationExtracted: 0.7,
                    strength: 0.6,
                },
            ],
        })

        const options = getPostOptions()
        expect(getMultipartPartNames(options)).toEqual(['request'])

        const request = getRequestFromMultipart(options)
        expect(request.parameters.reference_image_multiple_cached).toEqual([
            { cache_secret_key: 'vibe-key' },
        ])
        expect(request.parameters.reference_information_extracted_multiple).toEqual([0.7])
        expect(request.parameters.reference_strength_multiple).toEqual([0.6])
        expect(request.parameters.reference_image_multiple).toBeUndefined()
    })

    it('returns a local mock image without calling NovelAI', async () => {
        const result = await generateImage('key', baseParams, {
            settings: { enabled: false, recentRequestLimit: 20 },
            mode: 'mock',
        })

        expect(result.seed).toBe(12345)
        expect(result.imageData.byteLength).toBeGreaterThan(100)
        expect(postMock).not.toHaveBeenCalled()
    })

    it('throws a deterministic error in fail mode', async () => {
        // eslint-disable-next-line typescript/await-thenable -- Bun async resolves/rejects matchers are awaited even though their types return void.
        await expect(
            generateImage('key', baseParams, {
                settings: { enabled: false, recentRequestLimit: 20 },
                mode: 'fail',
            }),
        ).rejects.toThrow('NovelAI test failure mode is enabled')
        expect(postMock).not.toHaveBeenCalled()
    })
})

describe('encodeVibe', () => {
    beforeEach(() => {
        postMock.mockClear()
        arrayBufferMock.mockClear()
        arrayBufferMock.mockImplementation(() =>
            Promise.resolve(new Uint8Array([72, 101, 108, 108, 111]).buffer),
        )
    })

    it('rejects V5 vibe encoding before posting', async () => {
        // eslint-disable-next-line typescript/await-thenable -- Bun async resolves/rejects matchers are awaited even though their types return void.
        await expect(
            encodeVibe('key', {
                image: 'image',
                information_extracted: 1,
                model: 'nai-diffusion-5-curated',
            }),
        ).rejects.toThrow('NovelAI V5 does not support Vibe Transfer')
        expect(postMock).not.toHaveBeenCalled()
    })

    it('posts image and request as multipart binary parts', async () => {
        const result = await encodeVibe('key', {
            image: Buffer.from([1, 2, 3]).toString('base64'),
            imageContentType: 'image/png',
            information_extracted: 0.7,
            model: 'nai-diffusion-4-5-full',
        })

        expect(result).toBe(Buffer.from('Hello').toString('base64'))

        const options = getPostOptions()
        expect(options.headers?.['Content-Type']).toMatch(
            /^multipart\/form-data; boundary=----WebKitFormBoundary/,
        )
        expect(getMultipartPartNames(options)).toEqual(['image', 'request'])
        expect(getMultipartText(options)).toContain(
            'Content-Disposition: form-data; name="image"; filename="blob"\r\nContent-Type: image/png\r\n',
        )

        const request = getRequestFromMultipart(options)
        expect(request).toEqual({
            image: 'image',
            information_extracted: 0.7,
            model: 'nai-diffusion-4-5-full',
        })
    })
})

describe('NovelAI model validation', () => {
    for (const model of NOVEL_AI_MODELS) {
        it(`accepts ${model} in project and playground parameters`, () => {
            const parameters = { ...DEFAULT_PROJECT_PARAMETERS, model }
            expect(Parameters.parse(parameters).model).toBe(model)
            expect(ProjectPatchBody.parse({ parameters }).parameters?.model).toBe(model)
            expect(
                PlaygroundEnqueueBody.parse({ prompt: 'a cat', parameters }).parameters.model,
            ).toBe(model)
        })
    }
})

describe('fetchAnlasStatus', () => {
    const originalFetch = globalThis.fetch

    afterEach(() => {
        globalThis.fetch = originalFetch
    })

    it('sums fixed and purchased training steps as Anlas', async () => {
        globalThis.fetch = mock(() =>
            Promise.resolve(
                new Response(
                    JSON.stringify({
                        subscription: {
                            perks: { unlimited: false },
                            trainingStepsLeft: {
                                fixedTrainingStepsLeft: 1200,
                                purchasedTrainingSteps: 300,
                            },
                        },
                    }),
                ),
            ),
        ) as unknown as typeof fetch

        // eslint-disable-next-line typescript/await-thenable -- Bun async resolves/rejects matchers are awaited even though their types return void.
        await expect(fetchAnlasStatus('key')).resolves.toEqual({
            unlimited: false,
            anlas: 1500,
        })
        expect(globalThis.fetch).toHaveBeenCalledWith('https://image.novelai.net/user/data', {
            headers: { Authorization: 'Bearer key' },
        })
    })

    it('includes NovelAI response details when Anlas status fails', async () => {
        globalThis.fetch = mock(() =>
            Promise.resolve(
                new Response(JSON.stringify({ message: 'use image API host' }), {
                    status: 400,
                }),
            ),
        ) as unknown as typeof fetch

        // eslint-disable-next-line typescript/await-thenable -- Bun async resolves/rejects matchers are awaited even though their types return void.
        await expect(fetchAnlasStatus('key')).rejects.toThrow(
            'NovelAI account status failed (400): use image API host',
        )
    })
})
