import {
    createCipheriv,
    createDecipheriv,
    hkdfSync,
    randomBytes,
    randomUUID,
    timingSafeEqual,
} from 'node:crypto'
import fs from 'node:fs/promises'
import { dirname, join, relative, sep } from 'node:path'

import type { DataPaths } from './paths'

const ENCRYPTION_MAGIC = Buffer.from('NAIFENC1')
const ENCRYPTION_INFO = Buffer.from('nai-factory-data-v1')
const SALT_BYTES = 16
const IV_BYTES = 12
const AUTH_TAG_BYTES = 16
const ENCRYPTION_HEADER_BYTES = ENCRYPTION_MAGIC.byteLength + SALT_BYTES + IV_BYTES

export function isEncryptedData(data: Uint8Array) {
    if (data.byteLength < ENCRYPTION_MAGIC.byteLength) return false
    return timingSafeEqual(
        Buffer.from(data.subarray(0, ENCRYPTION_MAGIC.byteLength)),
        ENCRYPTION_MAGIC,
    )
}

function deriveFileKey(masterKey: Buffer, salt: Buffer) {
    return Buffer.from(hkdfSync('sha256', masterKey, salt, ENCRYPTION_INFO, 32))
}

/** AES-256-GCM with a per-file HKDF key. `key` is the base64 master key. */
export function encrypt(data: Uint8Array, key: string) {
    const salt = randomBytes(SALT_BYTES)
    const iv = randomBytes(IV_BYTES)
    const header = Buffer.concat([ENCRYPTION_MAGIC, salt, iv])
    const cipher = createCipheriv(
        'aes-256-gcm',
        deriveFileKey(Buffer.from(key, 'base64'), salt),
        iv,
    )

    cipher.setAAD(header)
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
    return Buffer.concat([header, encrypted, cipher.getAuthTag()])
}

/** Decrypts data written by {@link encrypt}; plaintext data is returned unchanged. */
export function decrypt(data: Uint8Array, key: string | null) {
    if (!isEncryptedData(data)) return Buffer.from(data)
    if (!key) throw new Error('Data is encrypted but no encryption key is configured')
    if (data.byteLength < ENCRYPTION_HEADER_BYTES + AUTH_TAG_BYTES) {
        throw new Error('Encrypted data is truncated')
    }

    const buffer = Buffer.from(data)
    const salt = buffer.subarray(
        ENCRYPTION_MAGIC.byteLength,
        ENCRYPTION_MAGIC.byteLength + SALT_BYTES,
    )
    const iv = buffer.subarray(ENCRYPTION_MAGIC.byteLength + SALT_BYTES, ENCRYPTION_HEADER_BYTES)
    const decipher = createDecipheriv(
        'aes-256-gcm',
        deriveFileKey(Buffer.from(key, 'base64'), salt),
        iv,
    )

    decipher.setAAD(buffer.subarray(0, ENCRYPTION_HEADER_BYTES))
    decipher.setAuthTag(buffer.subarray(-AUTH_TAG_BYTES))
    return Buffer.concat([
        decipher.update(buffer.subarray(ENCRYPTION_HEADER_BYTES, -AUTH_TAG_BYTES)),
        decipher.final(),
    ])
}

export type Storage = ReturnType<typeof createStorage>

/** File access below the data root. All paths are validated relative paths. */
export function createStorage(paths: DataPaths, encryptionKey: string | null) {
    return {
        encrypted: encryptionKey !== null,

        /** Writes atomically (temp file + rename), encrypting when enabled. */
        async writeFile(relPath: string, data: Uint8Array) {
            const target = paths.resolve(relPath)
            await fs.mkdir(dirname(target), { recursive: true })
            const temp = `${target}.${randomUUID()}.tmp`
            const encoded = encryptionKey ? encrypt(data, encryptionKey) : data
            try {
                await fs.writeFile(temp, encoded)
                await fs.rename(temp, target)
            } catch (error) {
                await fs.rm(temp, { force: true })
                throw error
            }
        },

        async readFile(relPath: string) {
            return decrypt(await fs.readFile(await paths.resolveExisting(relPath)), encryptionKey)
        },

        async exists(relPath: string) {
            try {
                await paths.resolveExisting(relPath)
                return true
            } catch {
                return false
            }
        },

        async remove(relPath: string) {
            await fs.rm(paths.resolve(relPath), { force: true })
        },

        /** Renames a stored file; the bytes stay encoded as they are. */
        async move(fromRelPath: string, toRelPath: string) {
            const target = paths.resolve(toRelPath)
            await fs.mkdir(dirname(target), { recursive: true })
            await fs.rename(paths.resolve(fromRelPath), target)
        },

        async removeDir(relDir: string) {
            await fs.rm(paths.resolve(relDir), { recursive: true, force: true })
        },

        async listFiles(relDir: string) {
            const base = paths.resolve(relDir)
            const result: { relPath: string; mtimeMs: number }[] = []

            async function walk(dir: string) {
                let entries
                try {
                    entries = await fs.readdir(dir, { withFileTypes: true })
                } catch {
                    return
                }
                for (const entry of entries) {
                    const full = join(dir, entry.name)
                    if (entry.isDirectory()) {
                        await walk(full)
                    } else if (entry.isFile()) {
                        const stat = await fs.stat(full)
                        result.push({
                            relPath: relative(paths.root, full).split(sep).join('/'),
                            mtimeMs: stat.mtimeMs,
                        })
                    }
                }
            }

            await walk(base)
            return result
        },

        async listDirs(relDir: string) {
            let entries
            try {
                entries = await fs.readdir(paths.resolve(relDir), { withFileTypes: true })
            } catch {
                return []
            }
            return Promise.all(
                entries
                    .filter((entry) => entry.isDirectory())
                    .map(async (entry) => {
                        const relPath = `${relDir}/${entry.name}`
                        const stat = await fs.stat(paths.resolve(relPath))
                        return { relPath, mtimeMs: stat.mtimeMs }
                    }),
            )
        },
    }
}
