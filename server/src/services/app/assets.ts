import { createHash } from 'node:crypto'
import { extname } from 'node:path'
import { eq, inArray } from 'drizzle-orm'
import sharp from 'sharp'
import * as dataStorage from '@/data'
import { assets, db } from '@/db'
import logger from '@/logger'

const log = logger.child({ module: 'asset-service' })

export type AssetKind =
    | 'image'
    | 'image-thumbnail'
    | 'playground-image'
    | 'playground-image-thumbnail'
    | 'character-reference-source'
    | 'character-reference-thumbnail'
    | 'character-reference-processed'
    | 'vibe-source'

function contentType(path: string) {
    switch (extname(path).toLowerCase()) {
        case '.png':
            return 'image/png'
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg'
        case '.webp':
            return 'image/webp'
        case '.avif':
            return 'image/avif'
        default:
            return 'application/octet-stream'
    }
}

async function imageDimensions(data: Buffer) {
    try {
        const metadata = await sharp(data).metadata()
        return {
            width: metadata.width ?? null,
            height: metadata.height ?? null,
        }
    } catch {
        return { width: null, height: null }
    }
}

export async function createAsset(kind: AssetKind, path: string) {
    const normalizedPath = path.replaceAll('\\', '/')
    const data = await dataStorage.readFile(normalizedPath)
    const dimensions = await imageDimensions(data)
    const sha256 = createHash('sha256').update(data).digest('hex')

    const [asset] = await db
        .insert(assets)
        .values({
            kind,
            path: normalizedPath,
            contentType: contentType(normalizedPath),
            sizeBytes: data.byteLength,
            width: dimensions.width,
            height: dimensions.height,
            sha256,
        })
        .onConflictDoUpdate({
            target: assets.path,
            set: {
                kind,
                contentType: contentType(normalizedPath),
                sizeBytes: data.byteLength,
                width: dimensions.width,
                height: dimensions.height,
                sha256,
            },
        })
        .returning()

    if (!asset) throw new Error(`Failed to create asset for ${normalizedPath}`)
    return asset
}

export async function getAssetPath(assetId: number | null) {
    if (!assetId) return null
    const [asset] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1)
    return asset?.path ?? null
}

export async function removeAssets(assetIds: (number | null | undefined)[]) {
    const ids = [...new Set(assetIds.filter((id): id is number => id !== null && id !== undefined))]
    if (ids.length === 0) return

    const rows = await db.select().from(assets).where(inArray(assets.id, ids))
    for (const asset of rows) {
        try {
            await dataStorage.remove(asset.path)
            await db.delete(assets).where(eq(assets.id, asset.id))
        } catch (error) {
            log.error({ assetId: asset.id, path: asset.path, err: error }, 'Failed to remove asset')
        }
    }
}
