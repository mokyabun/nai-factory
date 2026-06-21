import { describe, expect, it } from 'bun:test'
import { decodeDataFromStorage, encodeDataForStorage, isEncryptedData } from '../src/data'

const key = Buffer.alloc(32, 1).toString('base64')
const otherKey = Buffer.alloc(32, 2).toString('base64')

describe('data storage encoding', () => {
    it('leaves data unchanged when encryption is disabled', () => {
        const input = Buffer.from('plain image bytes')
        const encoded = encodeDataForStorage(input, {
            NAI_FACTORY_DATA_ENCRYPTION_ENABLED: false,
            NAI_FACTORY_DATA_ENCRYPTION_KEY: null,
        })

        expect(encoded.equals(input)).toBe(true)
        expect(isEncryptedData(encoded)).toBe(false)
        expect(
            decodeDataFromStorage(encoded, {
                NAI_FACTORY_DATA_ENCRYPTION_ENABLED: false,
                NAI_FACTORY_DATA_ENCRYPTION_KEY: null,
            }).equals(input),
        ).toBe(true)
    })

    it('encrypts and decrypts data with AES-GCM', () => {
        const input = Buffer.from('image bytes that should not be visible at rest')
        const encoded = encodeDataForStorage(input, {
            NAI_FACTORY_DATA_ENCRYPTION_ENABLED: true,
            NAI_FACTORY_DATA_ENCRYPTION_KEY: key,
        })

        expect(isEncryptedData(encoded)).toBe(true)
        expect(encoded.includes(input)).toBe(false)
        expect(encoded.byteLength).toBe(input.byteLength + 52)
        expect(
            decodeDataFromStorage(encoded, {
                NAI_FACTORY_DATA_ENCRYPTION_ENABLED: true,
                NAI_FACTORY_DATA_ENCRYPTION_KEY: key,
            }).equals(input),
        ).toBe(true)
    })

    it('rejects encrypted data with the wrong key', () => {
        const input = Buffer.from('private image')
        const encoded = encodeDataForStorage(input, {
            NAI_FACTORY_DATA_ENCRYPTION_ENABLED: true,
            NAI_FACTORY_DATA_ENCRYPTION_KEY: key,
        })

        expect(() =>
            decodeDataFromStorage(encoded, {
                NAI_FACTORY_DATA_ENCRYPTION_ENABLED: true,
                NAI_FACTORY_DATA_ENCRYPTION_KEY: otherKey,
            }),
        ).toThrow()
    })
})
