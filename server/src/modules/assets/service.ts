import { createHash, randomUUID } from 'node:crypto'

import type { AssetKind, ImageSaveType } from '@nai-factory/shared'
import sharp from 'sharp'

import type { AppContext } from '@/context'
import type { DbOrTx } from '@/db'
import { AppError } from '@/lib/http'
import {
    contentTypeForExtension,
    contentTypeForFormat,
    extensionForFormat,
    type ImageFormat,
    sniffImageFormat,
} from '@/lib/mime'
import { escapeXml } from '@/lib/xml'

import * as repo from './repo'

export type { AssetRow } from './repo'

/** Upper bound for decoded pixels of untrusted images. */
export const MAX_INPUT_PIXELS = 100_000_000
/** Data folders the GC may clean; everything else in the data root is left alone. */
export const MANAGED_DIRS = ['images', 'thumbs', 'playground', 'refs'] as const
export const GC_GRACE_MS = 10 * 60 * 1000

/** A file written to storage but not yet recorded in the database. */
export type PreparedAsset = {
    kind: AssetKind
    relPath: string
    contentType: string
    sizeBytes: number
    width: number | null
    height: number | null
    sha256: string
    encrypted: boolean
}

export function sha256(data: Uint8Array) {
    return createHash('sha256').update(data).digest('hex')
}

/** Writes bytes as a new file in `relDir` and describes it for a later insert. */
export async function prepare(
    ctx: AppContext,
    input: {
        kind: AssetKind
        relDir: string
        data: Uint8Array
        extension: string
        width?: number | null
        height?: number | null
    },
): Promise<PreparedAsset> {
    const relPath = `${input.relDir}/${randomUUID()}.${input.extension}`
    await ctx.storage.writeFile(relPath, input.data)
    return {
        kind: input.kind,
        relPath,
        contentType: contentTypeForExtension(input.extension),
        sizeBytes: input.data.byteLength,
        width: input.width ?? null,
        height: input.height ?? null,
        sha256: sha256(input.data),
        encrypted: ctx.storage.encrypted,
    }
}

function createXmpPacket(serializedMetadata: string) {
    const escaped = escapeXml(serializedMetadata)
    return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:nai="https://nai-factory.local/metadata/1.0/">
      <dc:description><rdf:Alt><rdf:li xml:lang="x-default">${escaped}</rdf:li></rdf:Alt></dc:description>
      <nai:metadata>${escaped}</nai:metadata>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`
}

export type ImageEncoding = {
    saveType: ImageSaveType | { type: 'png' }
    /** Fit inside a square of this size without enlarging. */
    maxSize?: number
    /** Fit exactly into these dimensions, padding with black. */
    contain?: { width: number; height: number }
    metadata?: Record<string, unknown>
}

/** Re-encodes an image in memory; dimensions come from the encoder, not a second read. */
export async function encodeImage(data: Uint8Array, encoding: ImageEncoding) {
    let image = sharp(data, { limitInputPixels: MAX_INPUT_PIXELS })
    if (encoding.contain) {
        image = image.resize(encoding.contain.width, encoding.contain.height, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0 },
        })
    } else if (encoding.maxSize) {
        image = image.resize(encoding.maxSize, encoding.maxSize, {
            fit: 'inside',
            withoutEnlargement: true,
        })
    }

    const saveType = encoding.saveType
    if (saveType.type === 'png') image = image.png()
    else if (saveType.type === 'webp') image = image.webp({ quality: saveType.quality })
    else image = image.avif({ quality: saveType.quality })

    if (encoding.metadata) {
        const serialized = JSON.stringify(encoding.metadata)
        image = image
            .withExif({ IFD0: { Software: 'NAI Factory', ImageDescription: serialized } })
            .withXmp(createXmpPacket(serialized))
    }

    const { data: output, info } = await image.toBuffer({ resolveWithObject: true })
    const format: ImageFormat = saveType.type === 'png' ? 'png' : saveType.type
    return { data: new Uint8Array(output), width: info.width, height: info.height, format }
}

export async function prepareImage(
    ctx: AppContext,
    data: Uint8Array,
    target: { kind: AssetKind; relDir: string } & ImageEncoding,
) {
    const encoded = await encodeImage(data, target)
    return prepare(ctx, {
        kind: target.kind,
        relDir: target.relDir,
        data: encoded.data,
        extension: extensionForFormat(encoded.format),
        width: encoded.width,
        height: encoded.height,
    })
}

/** Validates an uploaded image by its magic bytes and returns its bytes and format. */
export async function readUploadedImage(file: Blob) {
    const data = new Uint8Array(await file.arrayBuffer())
    const format = sniffImageFormat(data)
    if (!format) {
        throw new AppError(
            415,
            'unsupported_media_type',
            'Only PNG, JPEG, WebP and AVIF images are supported',
        )
    }
    try {
        const metadata = await sharp(data, { limitInputPixels: MAX_INPUT_PIXELS }).metadata()
        return { data, format, width: metadata.width ?? null, height: metadata.height ?? null }
    } catch (error) {
        throw new AppError(
            400,
            'bad_request',
            `Invalid image: ${error instanceof Error ? error.message : String(error)}`,
        )
    }
}

export async function prepareUpload(
    ctx: AppContext,
    upload: Awaited<ReturnType<typeof readUploadedImage>>,
    target: { kind: AssetKind; relDir: string },
) {
    return prepare(ctx, {
        ...target,
        data: upload.data,
        extension: extensionForFormat(upload.format),
        width: upload.width,
        height: upload.height,
    })
}

/** Records prepared files. Must run inside the transaction that creates their owner. */
export function insertPrepared(tx: DbOrTx, prepared: PreparedAsset) {
    return repo.insert(tx, prepared)
}

/** Removes files of prepared assets whose transaction failed. */
export async function discard(ctx: AppContext, prepared: (PreparedAsset | null | undefined)[]) {
    await removeFiles(
        ctx,
        prepared.filter((item): item is PreparedAsset => !!item).map((item) => item.relPath),
    )
}

/**
 * Deletes asset rows that are no longer referenced. Call inside the transaction that removed
 * their owners, then pass the returned paths to {@link removeFiles} after it commits.
 */
export function deleteUnreferenced(tx: DbOrTx, ids: (number | null | undefined)[]) {
    const unique = [...new Set(ids.filter((id): id is number => typeof id === 'number'))]
    const orphans = repo.findUnreferenced(tx, unique)
    repo.deleteByIds(
        tx,
        orphans.map((row) => row.id),
    )
    return orphans.map((row) => row.relPath)
}

/** Best-effort file removal after a commit; leftovers are collected by the GC. */
export async function removeFiles(ctx: AppContext, relPaths: string[]) {
    await Promise.all(
        relPaths.map(async (relPath) => {
            try {
                await ctx.storage.remove(relPath)
            } catch (error) {
                ctx.log.warn({ relPath, err: error }, 'Failed to remove asset file')
            }
        }),
    )
}

export function get(ctx: AppContext, id: number) {
    return repo.getById(ctx.db, id)
}

export async function read(ctx: AppContext, id: number) {
    const asset = repo.getById(ctx.db, id)
    if (!asset) throw new AppError(404, 'not_found', 'Asset not found')
    return { asset, data: await ctx.storage.readFile(asset.relPath) }
}

export async function serve(ctx: AppContext, idParam: string, ifNoneMatch: string | undefined) {
    const id = Number(idParam)
    const asset = Number.isSafeInteger(id) && id > 0 ? repo.getById(ctx.db, id) : null
    if (!asset) return new Response('Not found', { status: 404 })

    const etag = `"${asset.sha256}"`
    const headers = {
        ETag: etag,
        'Cache-Control': 'private, max-age=31536000, immutable',
        'Content-Type': asset.contentType,
        'X-Content-Type-Options': 'nosniff',
    }
    if (ifNoneMatch?.split(',').some((value) => value.trim() === etag)) {
        return new Response(null, { status: 304, headers })
    }

    try {
        return new Response(await ctx.storage.readFile(asset.relPath), { headers })
    } catch (error) {
        ctx.log.warn({ assetId: id, err: error }, 'Asset file is missing')
        return new Response('Not found', { status: 404 })
    }
}

export async function collectGarbage(ctx: AppContext, options: { dryRun: boolean }) {
    const orphanAssets = repo.findUnreferenced(ctx.db)
    const known = repo.allRelPaths(ctx.db)
    const cutoff = Date.now() - GC_GRACE_MS
    const orphanFiles: string[] = []

    for (const dir of MANAGED_DIRS) {
        for (const file of await ctx.storage.listFiles(dir)) {
            if (!known.has(file.relPath) && file.mtimeMs < cutoff) orphanFiles.push(file.relPath)
        }
    }

    if (!options.dryRun) {
        const removed = ctx.db.transaction((tx) =>
            deleteUnreferenced(
                tx,
                orphanAssets.map((asset) => asset.id),
            ),
        )
        await removeFiles(ctx, [...removed, ...orphanFiles])
        ctx.log.info(
            { event: 'assets.gc', orphanAssets: removed.length, orphanFiles: orphanFiles.length },
            'Asset garbage collection finished',
        )
    }

    return { dryRun: options.dryRun, orphanAssets, orphanFiles }
}

export { contentTypeForFormat }
