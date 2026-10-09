import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { readImageSettings } from './read-image-settings'

function fixture(name: string) {
    return readFileSync(new URL(`./fixtures/${name}`, import.meta.url))
}

function textChunk(keyword: string, text: string) {
    const data = Buffer.concat([Buffer.from(`${keyword}\0`, 'latin1'), Buffer.from(text)])
    const chunk = Buffer.alloc(12 + data.length)
    chunk.writeUInt32BE(data.length, 0)
    chunk.write('tEXt', 4, 'latin1')
    data.copy(chunk, 8)
    return chunk
}

/** Inserts text chunks after IHDR; the reader does not check CRCs, so they stay zero. */
function pngWithText(chunks: Record<string, string>) {
    const png = fixture('plain.png')
    const headerEnd = 8 + 12 + png.readUInt32BE(8)
    const text = Object.entries(chunks).map(([keyword, value]) => textChunk(keyword, value))
    return Buffer.concat([png.subarray(0, headerEnd), ...text, png.subarray(headerEnd)])
}

describe('readImageSettings', () => {
    it('restores prompt, parameters and characters from an original NovelAI PNG', async () => {
        const result = await readImageSettings(new Blob([fixture('novelai.png')]))

        expect(result).toEqual({
            origin: 'novelai',
            settings: {
                prompt: '1girl, solo, {{smile}}, outdoors, very aesthetic, masterpiece, no text',
                negativePrompt: 'lowres, bad anatomy, {bad hands}',
                characterPrompts: [
                    {
                        enabled: true,
                        prompt: 'girl, red hair',
                        uc: 'extra arms',
                        center: { x: 0.3, y: 0.5 },
                    },
                    {
                        enabled: true,
                        prompt: 'boy, black hair',
                        uc: '',
                        center: { x: 0.7, y: 0.5 },
                    },
                ],
                parameters: {
                    model: 'nai-diffusion-4-5-full',
                    width: 832,
                    height: 1216,
                    steps: 28,
                    promptGuidance: 5,
                    promptGuidanceRescale: 0,
                    sampler: 'k_euler_ancestral',
                    noiseSchedule: 'karras',
                    varietyPlus: true,
                    useCharacterPositions: true,
                },
                seed: 3141592653,
                references: { vibeTransfers: 0, characterReferences: 0 },
            },
            unsupported: [],
        })
    })

    it.each(['nai-factory.png', 'nai-factory.webp'])(
        'reads the metadata nai-factory embeds in %s',
        async (name) => {
            const result = await readImageSettings(new Blob([fixture(name)]))

            expect(result?.origin).toBe('nai-factory')
            expect(result?.settings.prompt).toBe('1girl, {{smile}}, <sparkle> & "한글"')
            expect(result?.settings.characterPrompts).toEqual([
                {
                    enabled: true,
                    center: { x: 0.3, y: 0.7 },
                    prompt: 'girl, red hair',
                    uc: 'extra arms',
                },
            ])
            expect(result?.settings.parameters).toMatchObject({
                model: 'nai-diffusion-4-5-full',
                sampler: 'k_dpmpp_2m',
                qualityToggle: true,
            })
            expect(result?.settings.seed).toBe(123456789)
            expect(result?.unsupported).toEqual(['바이브 전송 1개 (이미지는 메타데이터에 없음)'])
        },
    )

    it('lists what a NovelAI image records but cannot be applied', async () => {
        const comment = {
            prompt: 'cat',
            uc: '',
            sampler: 'ddim_v3',
            steps: 28,
            seed: 1,
            request_type: 'Img2ImgRequest',
            reference_strength_multiple: [0.6, 0.4],
        }
        const png = pngWithText({ Comment: JSON.stringify(comment), Source: 'Stable Diffusion XL' })

        const result = await readImageSettings(new Blob([png]))

        expect(result?.settings.parameters).toEqual({ steps: 28 })
        expect(result?.unsupported).toEqual([
            '모델: Stable Diffusion XL',
            '요청 종류: Img2ImgRequest (원본 이미지는 메타데이터에 없음)',
            '샘플러: ddim_v3',
            '바이브 전송 2개 (이미지는 메타데이터에 없음)',
        ])
    })

    it('returns null for an image without generation settings', async () => {
        expect(await readImageSettings(new Blob([fixture('plain.png')]))).toBeNull()
    })
})
