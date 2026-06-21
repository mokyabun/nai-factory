import type { NovelAIModel, NovelAIVibeImage } from '@nai-factory/shared'
import { asc, eq } from 'drizzle-orm'
import * as dataStorage from '@/data'
import { db, vibeTransfers } from '@/db'
import logger from '@/logger'
import { nowIso } from '@/shared'
import { createUniqueReferenceCacheKey, isReferenceCacheFresh } from './reference-cache'

const log = logger.child({ module: 'vibe-image' })

export async function checkVibe(
    vibeTransferId: number,
    _apiKey?: string,
    _model?: NovelAIModel,
): Promise<NovelAIVibeImage> {
    const [vibe] = await db.select().from(vibeTransfers).where(eq(vibeTransfers.id, vibeTransferId))

    if (!vibe) throw new Error(`Vibe transfer ${vibeTransferId} not found`)

    if (!(await dataStorage.exists(vibe.sourceImagePath))) {
        throw new Error(`Vibe source image not found: ${vibe.sourceImagePath}`)
    }

    let cacheSecretKey = vibe.cacheSecretKey
    let uploadFieldName: string | undefined
    let filePath: string | undefined

    if (!isReferenceCacheFresh(vibe.cacheSecretKey, vibe.cacheCreatedAt)) {
        cacheSecretKey = await createUniqueReferenceCacheKey()
        uploadFieldName = 'ref_multiple_0'
        filePath = vibe.sourceImagePath

        await db
            .update(vibeTransfers)
            .set({
                cacheSecretKey,
                cacheCreatedAt: null,
                updatedAt: nowIso(),
            })
            .where(eq(vibeTransfers.id, vibeTransferId))
        log.debug({ vibeTransferId }, 'Vibe reference cache refreshed')
    } else {
        log.debug({ vibeTransferId }, 'Vibe reference cache hit')
    }

    if (!cacheSecretKey) throw new Error(`Vibe transfer ${vibeTransferId} has no cache key`)

    return {
        id: vibe.id,
        cacheSecretKey,
        uploadFieldName,
        filePath,
        strength: vibe.referenceStrength,
    }
}

export async function checkVibesForProject(
    projectId: number,
    apiKey?: string,
    model?: NovelAIModel,
): Promise<NovelAIVibeImage[]> {
    const vibes = await db
        .select()
        .from(vibeTransfers)
        .where(eq(vibeTransfers.projectId, projectId))
        .orderBy(asc(vibeTransfers.displayOrder), asc(vibeTransfers.id))

    if (vibes.length === 0) {
        log.debug({ projectId }, 'No vibe transfers configured')
        return []
    }

    const results: NovelAIVibeImage[] = []

    for (const [index, vibe] of vibes.entries()) {
        const result = await checkVibe(vibe.id, apiKey, model)
        if (result.uploadFieldName) result.uploadFieldName = `ref_multiple_${index}`
        results.push(result)
    }

    log.debug(
        {
            projectId,
            model,
            preparedCount: results.length,
            uploadCount: results.filter((ref) => ref.uploadFieldName).length,
        },
        'Vibe transfers prepared',
    )

    return results
}

export async function invalidateVibe(vibeTransferId: number): Promise<void> {
    await db
        .update(vibeTransfers)
        .set({
            encodedData: null,
            encodedInformationExtracted: null,
            cacheSecretKey: null,
            cacheCreatedAt: null,
            updatedAt: nowIso(),
        })
        .where(eq(vibeTransfers.id, vibeTransferId))

    log.info({ vibeTransferId }, 'Vibe encoding invalidated')
}

export async function markVibeCachesUploaded(ids: number[]) {
    if (ids.length === 0) return

    const cacheCreatedAt = nowIso()
    for (const id of ids) {
        await db
            .update(vibeTransfers)
            .set({ cacheCreatedAt, updatedAt: cacheCreatedAt })
            .where(eq(vibeTransfers.id, id))
    }
    log.debug({ ids }, 'Vibe caches marked uploaded')
}
