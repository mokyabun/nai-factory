import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { SimpleNovelAIParameters } from '@nai-factory/types'
import { zipSync } from 'fflate'

const arrayBufferMock = mock(() => Promise.resolve(new ArrayBuffer(0)))
const postMock = mock(() => ({ arrayBuffer: arrayBufferMock }))

mock.module('ky', () => ({
    default: { post: postMock },
}))

const { encodeVibe, generateImage } = await import('../../src/services/novelai')

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

async function getRequestFromForm(form: FormData) {
    const request = form.get('request')
    expect(request).toBeInstanceOf(Blob)
    return JSON.parse(await (request as Blob).text())
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

    it('uses JSON for generation without cached references', async () => {
        await generateImage('key', baseParams)

        expect(postMock).toHaveBeenCalledWith(
            'https://image.novelai.net/ai/generate-image',
            expect.objectContaining({
                json: expect.objectContaining({
                    parameters: expect.not.objectContaining({
                        reference_image_multiple_cached: expect.anything(),
                    }),
                }),
            }),
        )
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

        const [, options] = postMock.mock.calls[0]!
        const form = options.body as FormData
        expect([...form.keys()]).toEqual(['director_ref_0', 'request'])

        const request = await getRequestFromForm(form)
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

        const [, options] = postMock.mock.calls[0]!
        const form = options.body as FormData
        expect([...form.keys()]).toEqual(['request'])

        const request = await getRequestFromForm(form)
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
                    filePath: tempImagePath,
                    strength: 0.6,
                },
            ],
        })

        const [, options] = postMock.mock.calls[0]!
        const form = options.body as FormData
        expect([...form.keys()]).toEqual(['ref_multiple_0', 'request'])

        const request = await getRequestFromForm(form)
        expect(request.parameters.reference_image_multiple_cached).toEqual([
            { cache_secret_key: 'vibe-key', data: 'ref_multiple_0' },
        ])
        expect(request.parameters.reference_strength_multiple).toEqual([0.6])
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

    it('posts image and request as multipart binary parts', async () => {
        const result = await encodeVibe('key', {
            image: Buffer.from([1, 2, 3]).toString('base64'),
            information_extracted: 0.7,
            model: 'nai-diffusion-4-5-full',
        })

        expect(result).toBe(Buffer.from('Hello').toString('base64'))

        const [, options] = postMock.mock.calls[0]!
        const form = options.body as FormData
        expect([...form.keys()]).toEqual(['image', 'request'])

        const request = await getRequestFromForm(form)
        expect(request).toEqual({
            information_extracted: 0.7,
            model: 'nai-diffusion-4-5-full',
        })
    })
})
