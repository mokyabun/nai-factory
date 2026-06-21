import {
    createCipheriv,
    createDecipheriv,
    hkdfSync,
    randomBytes,
    timingSafeEqual,
} from 'node:crypto'
import fs from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { type EnvConfig, envConfig } from './config'

const ENCRYPTION_MAGIC = Buffer.from('NAIFENC1')
const ENCRYPTION_INFO = Buffer.from('nai-factory-data-v1')
const SALT_BYTES = 16
const IV_BYTES = 12
const AUTH_TAG_BYTES = 16
const ENCRYPTION_HEADER_BYTES = ENCRYPTION_MAGIC.byteLength + SALT_BYTES + IV_BYTES

type EncryptionConfig = Pick<
    EnvConfig,
    'NAI_FACTORY_DATA_ENCRYPTION_ENABLED' | 'NAI_FACTORY_DATA_ENCRYPTION_KEY'
>

export function isEncryptedData(data: Uint8Array) {
    if (data.byteLength < ENCRYPTION_MAGIC.byteLength) return false
    return timingSafeEqual(
        Buffer.from(data.subarray(0, ENCRYPTION_MAGIC.byteLength)),
        ENCRYPTION_MAGIC,
    )
}

function getMasterKey(config: EncryptionConfig) {
    if (!config.NAI_FACTORY_DATA_ENCRYPTION_KEY) {
        throw new Error('Data encryption key is not configured')
    }
    return Buffer.from(config.NAI_FACTORY_DATA_ENCRYPTION_KEY, 'base64')
}

function deriveFileKey(masterKey: Buffer, salt: Buffer) {
    return Buffer.from(hkdfSync('sha256', masterKey, salt, ENCRYPTION_INFO, 32))
}

export function encodeDataForStorage(data: Uint8Array, config: EncryptionConfig = envConfig) {
    if (!config.NAI_FACTORY_DATA_ENCRYPTION_ENABLED) return Buffer.from(data)

    const salt = randomBytes(SALT_BYTES)
    const iv = randomBytes(IV_BYTES)
    const header = Buffer.concat([ENCRYPTION_MAGIC, salt, iv])
    const key = deriveFileKey(getMasterKey(config), salt)
    const cipher = createCipheriv('aes-256-gcm', key, iv)

    cipher.setAAD(header)
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
    const tag = cipher.getAuthTag()

    return Buffer.concat([header, encrypted, tag])
}

export function decodeDataFromStorage(data: Uint8Array, config: EncryptionConfig = envConfig) {
    if (!isEncryptedData(data)) return Buffer.from(data)
    if (data.byteLength < ENCRYPTION_HEADER_BYTES + AUTH_TAG_BYTES) {
        throw new Error('Encrypted data is truncated')
    }

    const buffer = Buffer.from(data)
    const salt = buffer.subarray(
        ENCRYPTION_MAGIC.byteLength,
        ENCRYPTION_MAGIC.byteLength + SALT_BYTES,
    )
    const iv = buffer.subarray(ENCRYPTION_MAGIC.byteLength + SALT_BYTES, ENCRYPTION_HEADER_BYTES)
    const ciphertext = buffer.subarray(ENCRYPTION_HEADER_BYTES, -AUTH_TAG_BYTES)
    const tag = buffer.subarray(-AUTH_TAG_BYTES)
    const header = buffer.subarray(0, ENCRYPTION_HEADER_BYTES)
    const key = deriveFileKey(getMasterKey(config), salt)
    const decipher = createDecipheriv('aes-256-gcm', key, iv)

    decipher.setAAD(header)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

export async function writeFile(path: string, data: Uint8Array) {
    await fs.mkdir(dirname(path), { recursive: true })
    await fs.writeFile(path, encodeDataForStorage(data))
}

export async function readFile(path: string) {
    return decodeDataFromStorage(await fs.readFile(path))
}

export async function remove(path: string | null) {
    if (!path) return
    await fs.rm(path, { force: true })
}

export async function exists(path: string | null) {
    if (!path) return false

    try {
        await fs.access(path)
        return true
    } catch {
        return false
    }
}

function contentType(path: string) {
    const lower = path.toLowerCase()
    if (lower.endsWith('.png')) return 'image/png'
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
    if (lower.endsWith('.webp')) return 'image/webp'
    if (lower.endsWith('.avif')) return 'image/avif'
    return 'application/octet-stream'
}

function resolvePublicDataPath(relativePath: string) {
    if (!relativePath.startsWith('data/')) throw new Error('Invalid data path')

    const root = resolve('.')
    const target = resolve(root, relativePath)
    if (target !== root && !target.startsWith(`${root}${sep}`)) {
        throw new Error('Invalid data path')
    }

    return target
}

export async function serveFile(relativePath: string) {
    try {
        const path = resolvePublicDataPath(relativePath)
        const data = await readFile(path)
        return new Response(data, {
            headers: {
                'content-type': contentType(path),
                'cache-control': 'public, max-age=31536000, immutable',
            },
        })
    } catch (error) {
        if (error instanceof Error && error.message === 'Invalid data path') {
            return new Response('Not found', { status: 404 })
        }
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
            return new Response('Not found', { status: 404 })
        }
        throw error
    }
}
