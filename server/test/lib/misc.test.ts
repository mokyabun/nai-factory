import { describe, expect, it } from 'bun:test'

import { deepMerge } from '@/lib/merge'
import { sniffImageFormat } from '@/lib/mime'
import { decrypt, encrypt } from '@/lib/storage'
import { renderOutputTemplate, uniqueFilename } from '@/modules/archive/filenames'

describe('sniffImageFormat', () => {
    it('detects formats by magic bytes', () => {
        expect(
            sniffImageFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
        ).toBe('png')
        expect(sniffImageFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg')
        expect(sniffImageFormat(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('webp')
        expect(sniffImageFormat(new TextEncoder().encode('\0\0\0\x1cftypavif'))).toBe('avif')
        expect(sniffImageFormat(new TextEncoder().encode('<svg></svg>'))).toBeNull()
    })
})

describe('deepMerge', () => {
    it('merges nested objects and replaces arrays', () => {
        expect(
            deepMerge(
                { a: { b: 1, c: 2 }, list: [1, 2], keep: 'x' },
                { a: { c: 3 }, list: [9], keep: undefined },
            ),
        ).toEqual({ a: { b: 1, c: 3 }, list: [9], keep: 'x' })
    })
})

describe('encryption', () => {
    it('round-trips data and passes plaintext through', () => {
        const key = Buffer.alloc(32, 7).toString('base64')
        const data = new TextEncoder().encode('hello')
        expect(new TextDecoder().decode(decrypt(encrypt(data, key), key))).toBe('hello')
        expect(new TextDecoder().decode(decrypt(data, key))).toBe('hello')
    })
})

describe('export filenames (C10)', () => {
    it('keeps every name unique, including generated suffixes', () => {
        const used = new Set<string>()
        const names = ['a.png', 'a.png', 'a.png', 'a-2.png'].map((name) =>
            uniqueFilename(name, used),
        )
        expect(new Set(names).size).toBe(4)
        expect(names).toEqual(['a.png', 'a-2.png', 'a-3.png', 'a-2-2.png'])
    })

    it('renders templates and sanitizes path characters', () => {
        expect(
            renderOutputTemplate('{character}/{scene}-{number}', {
                character: 'Alice',
                scene: '../x',
                number: 3,
                extension: 'png',
            }),
        ).toBe('Alice-..-x-3.png')
    })
})
