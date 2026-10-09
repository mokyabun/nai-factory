import { deflateSync, gzipSync } from 'node:zlib'

import { describe, expect, it } from 'vitest'

import { decodeStealthMetadata, readEmbeddedMetadata } from './image-metadata'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function chunk(type: string, data: Buffer) {
    const result = Buffer.alloc(12 + data.length)
    result.writeUInt32BE(data.length, 0)
    result.write(type, 4, 'latin1')
    data.copy(result, 8)
    return result
}

function png(...chunks: Buffer[]) {
    return new Uint8Array(Buffer.concat([PNG_SIGNATURE, ...chunks, chunk('IEND', Buffer.alloc(0))]))
}

function stealthPixels(magic: string, payload: Buffer, width: number, height: number) {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(payload.length * 8)
    const bytes = Buffer.concat([Buffer.from(magic), length, payload])
    const rgba = new Uint8Array(width * height * 4).fill(255)
    for (let index = 0; index < bytes.length * 8; index++) {
        const bit = (bytes[index >> 3]! >> (7 - (index & 7))) & 1
        const x = Math.floor(index / height)
        const y = index % height
        rgba[(y * width + x) * 4 + 3] = 254 | bit
    }
    return rgba
}

describe('readEmbeddedMetadata', () => {
    it('reads compressed zTXt and iTXt chunks as UTF-8', async () => {
        const bytes = png(
            chunk('zTXt', Buffer.concat([Buffer.from('Comment\0\0'), deflateSync('{"a":1}')])),
            chunk(
                'iTXt',
                Buffer.concat([Buffer.from('Title\0\x01\0ko\0제목\0'), deflateSync('한글 제목')]),
            ),
        )

        expect((await readEmbeddedMetadata(bytes)).text).toEqual({
            Comment: '{"a":1}',
            Title: '한글 제목',
        })
    })
})

describe('decodeStealthMetadata', () => {
    const json = JSON.stringify({ Comment: '{"prompt":"cat"}', Source: 'NovelAI Diffusion V4.5' })

    it('decodes gzip and raw payloads stored column by column', async () => {
        const compressed = stealthPixels('stealth_pngcomp', gzipSync(json), 64, 48)
        expect(await decodeStealthMetadata(compressed, 64, 48)).toBe(json)

        const raw = stealthPixels('stealth_pnginfo', Buffer.from(json), 64, 48)
        expect(await decodeStealthMetadata(raw, 64, 48)).toBe(json)
    })

    it('ignores images without the magic', async () => {
        const opaque = new Uint8Array(64 * 48 * 4).fill(255)
        expect(await decodeStealthMetadata(opaque, 64, 48)).toBeNull()
    })
})
