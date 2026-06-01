import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { characterReferences, db, vibeTransfers } from '@/db'

export const REFERENCE_CACHE_TTL_MS = 60 * 60 * 1000

export function isReferenceCacheFresh(
    cacheSecretKey: string | null,
    cacheCreatedAt: string | null,
) {
    if (!cacheSecretKey || !cacheCreatedAt) return false

    const createdAt = Date.parse(cacheCreatedAt)
    if (Number.isNaN(createdAt)) return false

    return Date.now() - createdAt < REFERENCE_CACHE_TTL_MS
}

export async function createUniqueReferenceCacheKey() {
    for (let attempt = 0; attempt < 20; attempt++) {
        const key = randomBytes(32).toString('hex')

        const [vibe] = await db
            .select({ id: vibeTransfers.id })
            .from(vibeTransfers)
            .where(eq(vibeTransfers.cacheSecretKey, key))
            .limit(1)

        if (vibe) continue

        const [characterReference] = await db
            .select({ id: characterReferences.id })
            .from(characterReferences)
            .where(eq(characterReferences.cacheSecretKey, key))
            .limit(1)

        if (!characterReference) return key
    }

    throw new Error('Failed to create a unique reference cache key')
}
