import { join } from 'node:path'
import type { NovelAIModel, NovelAIVibeImage } from '@nai-factory/shared'
import { asc, eq } from 'drizzle-orm'
import sharp from 'sharp'
import { envConfig } from '@/config'
import * as dataStorage from '@/data'
import { db, vibeTransfers } from '@/db'
import logger from '@/logger'
import { createAsset, getAssetPath, removeAssets } from '@/services/app/assets'
import { nowIso } from '@/utils'
import { encodeVibe } from './novelai'
import { createUniqueReferenceCacheKey, isReferenceCacheFresh } from './reference-cache'

const log = logger.child({ module: 'vibe-image' })

function encodedVibePath(projectId: number, vibeTransferId: number) {
    return join(
        envConfig.NAI_FACTORY_VIBES_DIR,
        String(projectId),
        `${vibeTransferId}_encoded.vibe`,
    ).replaceAll('\\', '/')
}

async function writeEncodedVibeAsset(
    projectId: number,
    vibeTransferId: number,
    encodedBytes: Uint8Array,
) {
    const path = encodedVibePath(projectId, vibeTransferId)
    await dataStorage.writeFile(path, encodedBytes)
    return createAsset('vibe-encoded', path)
}

async function readEncodedVibeAsset(assetId: number | null) {
    const path = await getAssetPath(assetId)
    if (!path || !(await dataStorage.exists(path))) return null
    return dataStorage.readFile(path)
}

export async function checkVibe(
    vibeTransferId: number,
    apiKey?: string,
    model?: NovelAIModel,
    uploadFieldName?: string,
): Promise<NovelAIVibeImage> {
    const [vibe] = await db.select().from(vibeTransfers).where(eq(vibeTransfers.id, vibeTransferId))

    if (!vibe) throw new Error(`Vibe transfer ${vibeTransferId} not found`)

    const sourceImagePath = (await getAssetPath(vibe.sourceAssetId)) ?? vibe.sourceImagePath

    if (!(await dataStorage.exists(sourceImagePath))) {
        throw new Error(`Vibe source image not found: ${sourceImagePath}`)
    }

    let cacheSecretKey = vibe.cacheSecretKey
    const cacheFresh = isReferenceCacheFresh(vibe.cacheSecretKey, vibe.cacheCreatedAt)
    const encodingMatches = vibe.encodedInformationExtracted === vibe.informationExtracted
    const shouldUpload = !cacheFresh || !encodingMatches
    let encodedBytes = encodingMatches ? await readEncodedVibeAsset(vibe.encodedAssetId) : null
    let encodedInformationExtracted = vibe.encodedInformationExtracted

    if (
        shouldUpload &&
        (!encodedBytes || encodedInformationExtracted !== vibe.informationExtracted)
    ) {
        if (!apiKey || !model) throw new Error('Vibe encoding requires NovelAI API settings')

        const pngData = await sharp(await dataStorage.readFile(sourceImagePath))
            .png()
            .toBuffer()
        const encodedBase64 = await encodeVibe(apiKey, {
            image: pngData.toString('base64'),
            imageContentType: 'image/png',
            information_extracted: vibe.informationExtracted,
            model,
        })
        encodedBytes = Buffer.from(encodedBase64, 'base64')
        encodedInformationExtracted = vibe.informationExtracted
        const encodedAsset = await writeEncodedVibeAsset(vibe.projectId, vibe.id, encodedBytes)

        await db
            .update(vibeTransfers)
            .set({
                encodedAssetId: encodedAsset.id,
                encodedInformationExtracted,
                updatedAt: nowIso(),
            })
            .where(eq(vibeTransfers.id, vibeTransferId))
        log.debug(
            {
                vibeTransferId,
                model,
                informationExtracted: vibe.informationExtracted,
            },
            'Vibe encoded',
        )
    }

    if (shouldUpload) {
        cacheSecretKey = await createUniqueReferenceCacheKey()
        await db
            .update(vibeTransfers)
            .set({
                cacheSecretKey,
                cacheCreatedAt: null,
                updatedAt: nowIso(),
            })
            .where(eq(vibeTransfers.id, vibeTransferId))
        log.debug(
            {
                vibeTransferId,
                informationExtracted: vibe.informationExtracted,
            },
            'Vibe reference cache refreshed',
        )
    }

    if (!cacheSecretKey) throw new Error(`Vibe transfer ${vibe.id} has no cache key`)

    return {
        id: vibe.id,
        cacheSecretKey,
        uploadFieldName: shouldUpload ? uploadFieldName : undefined,
        encodedBytes: shouldUpload ? (encodedBytes ?? undefined) : undefined,
        informationExtracted: encodedInformationExtracted ?? vibe.informationExtracted,
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
        const result = await checkVibe(vibe.id, apiKey, model, `ref_multiple_${index}`)
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
    const [existing] = await db
        .select({ encodedAssetId: vibeTransfers.encodedAssetId })
        .from(vibeTransfers)
        .where(eq(vibeTransfers.id, vibeTransferId))

    await db
        .update(vibeTransfers)
        .set({
            encodedAssetId: null,
            encodedInformationExtracted: null,
            cacheSecretKey: null,
            cacheCreatedAt: null,
            updatedAt: nowIso(),
        })
        .where(eq(vibeTransfers.id, vibeTransferId))
    await removeAssets([existing?.encodedAssetId])

    log.debug({ vibeTransferId }, 'Vibe encoding invalidated')
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
