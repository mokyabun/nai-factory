import { zipSync } from 'fflate'
import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { EncodeVibeRequest, SimpleNovelAIParameters } from '@/types'

const arrayBufferMock = mock(() => Promise.resolve(new ArrayBuffer(0)))
const postMock = mock(() => ({ arrayBuffer: arrayBufferMock }))

mock.module('ky', () => ({
    default: { post: postMock },
}))

const { encodeVibe, generateImage, validateApiKey } = await import('./novelai')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeZip(entries: Record<string, Uint8Array>): ArrayBuffer {
    return (zipSync(entries) as Uint8Array).buffer as ArrayBuffer
}

const pngZip = makeZip({ 'image.png': new Uint8Array([1, 2, 3]) })

const baseParams: SimpleNovelAIParameters = {
    prompt: 'a cat',
    negativePrompt: 'bad',
    characterPrompts: [],
    vibeTransfers: [],
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

// ---------------------------------------------------------------------------
// encodeVibe
// ---------------------------------------------------------------------------

describe('encodeVibe', () => {
    beforeEach(() => {
        postMock.mockClear()
        arrayBufferMock.mockClear()
    })

    it('returns a base64-encoded string of the response bytes', async () => {
        const bytes = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
        arrayBufferMock.mockImplementation(() => Promise.resolve(bytes.buffer as ArrayBuffer))

        const request: EncodeVibeRequest = {
            image: 'base64data',
            information_extracted: 1,
            model: 'nai-diffusion-4-5-full',
        }

        const result = await encodeVibe('key', request)

        expect(result).toBe(Buffer.from(bytes).toString('base64'))
    })

    it('posts to the encode-vibe endpoint', async () => {
        arrayBufferMock.mockImplementation(() => Promise.resolve(new ArrayBuffer(0)))

        const request: EncodeVibeRequest = {
            image: 'base64data',
            information_extracted: 1,
            model: 'nai-diffusion-4-5-full',
        }

        await encodeVibe('mykey', request)

        expect(postMock).toHaveBeenCalledWith(
            'https://image.novelai.net/ai/encode-vibe',
            expect.objectContaining({ json: request }),
        )
    })
})

// ---------------------------------------------------------------------------
// generateImage
// ---------------------------------------------------------------------------

describe('generateImage', () => {
    beforeEach(() => {
        postMock.mockClear()
        arrayBufferMock.mockClear()
        arrayBufferMock.mockImplementation(() => Promise.resolve(pngZip))
    })

    it('returns imageData as Uint8Array and seed as number', async () => {
        const result = await generateImage('key', baseParams)

        expect(result.imageData).toBeInstanceOf(Uint8Array)
        expect(typeof result.seed).toBe('number')
    })

    it('returns the image bytes stored in the zip', async () => {
        const result = await generateImage('key', baseParams)

        expect(result.imageData).toEqual(new Uint8Array([1, 2, 3]))
    })

    it('uses the provided seed', async () => {
        const result = await generateImage('key', { ...baseParams, seed: 99999 })

        expect(result.seed).toBe(99999)
    })

    it('generates a numeric seed when seed is not provided', async () => {
        const params = { ...baseParams, seed: undefined } as unknown as SimpleNovelAIParameters

        const result = await generateImage('key', params)

        expect(typeof result.seed).toBe('number')
        expect(result.seed).toBeGreaterThanOrEqual(0)
    })

    it('throws when the response zip is empty', async () => {
        arrayBufferMock.mockImplementation(() => Promise.resolve(makeZip({})))

        await expect(generateImage('key', baseParams)).rejects.toThrow('empty')
    })

    it('throws when the zip contains no image file', async () => {
        arrayBufferMock.mockImplementation(() =>
            Promise.resolve(makeZip({ 'data.json': new Uint8Array([1]) })),
        )

        await expect(generateImage('key', baseParams)).rejects.toThrow('No image')
    })
})

// ---------------------------------------------------------------------------
// validateApiKey
// ---------------------------------------------------------------------------

describe('validateApiKey', () => {
    it('returns true when subscription endpoint responds with 200', async () => {
        globalThis.fetch = mock(() =>
            Promise.resolve(new Response(null, { status: 200 })),
        ) as unknown as typeof fetch

        const result = await validateApiKey('valid-key')

        expect(result).toBe(true)
    })

    it('returns false when subscription endpoint responds with 401', async () => {
        globalThis.fetch = mock(() =>
            Promise.resolve(new Response(null, { status: 401 })),
        ) as unknown as typeof fetch

        const result = await validateApiKey('invalid-key')

        expect(result).toBe(false)
    })

    it('returns false when fetch throws a network error', async () => {
        globalThis.fetch = mock(() =>
            Promise.reject(new Error('network error')),
        ) as unknown as typeof fetch

        const result = await validateApiKey('key')

        expect(result).toBe(false)
    })
})
