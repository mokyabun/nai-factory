import { randomBytes } from 'node:crypto'

import {
    type CharacterReference,
    type CharacterReferencePatch,
    type MoveBody,
    type NovelAIModel,
    type VibeTransfer,
    type VibeTransferPatch,
} from '@nai-factory/shared'
import sharp from 'sharp'

import type { AppContext } from '@/context'
import type { DbOrTx } from '@/db'
import type { CharacterReferenceInput, VibeReference } from '@/integrations/novelai/request'
import { requireEntity } from '@/lib/http'
import { keyAfter, planMove } from '@/lib/order'
import { toIso } from '@/lib/time'
import * as assets from '@/modules/assets/service'
import * as projects from '@/modules/projects/service'
import * as scenes from '@/modules/scenes/service'

import * as repo from './repo'

export const REFERENCE_CACHE_TTL_MS = 60 * 60 * 1000
const DEFAULT_VIBE = { referenceStrength: 0.6, informationExtracted: 1 }
const DEFAULT_CHAR_REF = { strength: 0.6, fidelity: 0.5, mode: 'character&style' as const }
const CHAR_REF_THUMB_SIZE = 256
const DIRECTOR_DIMENSIONS = [
    { width: 1472, height: 1472 },
    { width: 1536, height: 1024 },
    { width: 1024, height: 1536 },
]

const vibeDir = (projectId: number) => `refs/vibe/${projectId}`
const charDir = (projectId: number) => `refs/char/${projectId}`

export function isCacheFresh(cacheKey: string | null, createdAt: Date | null, now = Date.now()) {
    return !!cacheKey && !!createdAt && now - createdAt.getTime() < REFERENCE_CACHE_TTL_MS
}

export function newCacheKey() {
    return randomBytes(32).toString('hex')
}

function isEncodingCurrent(row: repo.VibeRow, model?: NovelAIModel) {
    return (
        row.encodedAssetId !== null &&
        row.encodedInformationExtracted === row.informationExtracted &&
        (model === undefined || row.encodedForModel === model)
    )
}

function toVibe(row: repo.VibeRow): VibeTransfer {
    return {
        id: row.id,
        projectId: row.projectId,
        position: row.position,
        sourceAssetId: row.sourceAssetId,
        referenceStrength: row.referenceStrength,
        informationExtracted: row.informationExtracted,
        enabled: row.enabled,
        encoded: isEncodingCurrent(row),
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
    }
}

function toCharRef(row: repo.CharRefRow): CharacterReference {
    return {
        id: row.id,
        projectId: row.projectId,
        position: row.position,
        sourceAssetId: row.sourceAssetId,
        thumbAssetId: row.thumbAssetId,
        strength: row.strength,
        fidelity: row.fidelity,
        mode: row.mode,
        enabled: row.enabled,
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
    }
}

export function listVibes(ctx: AppContext, projectId: number) {
    projects.assertExists(ctx.db, projectId)
    return repo.vibes.list(ctx.db, projectId).map(toVibe)
}

export async function uploadVibe(ctx: AppContext, projectId: number, file: Blob) {
    projects.assertExists(ctx.db, projectId)
    const upload = await assets.readUploadedImage(file)
    const source = await assets.prepareUpload(ctx, upload, {
        kind: 'vibe_source',
        relDir: vibeDir(projectId),
    })
    try {
        return ctx.db.transaction((tx) => {
            projects.assertExists(tx, projectId)
            const asset = assets.insertPrepared(tx, source)
            const row = repo.vibes.insert(tx, {
                projectId,
                position: keyAfter(repo.vibes.lastPosition(tx, projectId)),
                sourceAssetId: asset.id,
                ...DEFAULT_VIBE,
                enabled: true,
            })
            return toVibe(row)
        })
    } catch (error) {
        await assets.discard(ctx, [source])
        throw error
    }
}

export function updateVibe(ctx: AppContext, id: number, patch: VibeTransferPatch) {
    return ctx.db.transaction((tx) => {
        requireEntity(repo.vibes.get(tx, id), 'Vibe transfer')
        return toVibe(requireEntity(repo.vibes.update(tx, id, patch), 'Vibe transfer'))
    })
}

export function moveVibe(ctx: AppContext, id: number, body: MoveBody) {
    return ctx.db.transaction((tx) => {
        const row = requireEntity(repo.vibes.get(tx, id), 'Vibe transfer')
        let updates
        try {
            updates = planMove(repo.vibes.list(tx, row.projectId), id, body.beforeId, body.afterId)
        } catch (error) {
            throw scenes.moveError(error, 'Vibe transfer')
        }
        for (const update of updates)
            repo.vibes.update(tx, update.id, { position: update.position })
        return toVibe(requireEntity(repo.vibes.get(tx, id), 'Vibe transfer'))
    })
}

export async function removeVibe(ctx: AppContext, id: number) {
    const removedPaths = ctx.db.transaction((tx) => {
        const row = requireEntity(repo.vibes.get(tx, id), 'Vibe transfer')
        repo.vibes.remove(tx, id)
        return assets.deleteUnreferenced(tx, [row.sourceAssetId, row.encodedAssetId])
    })
    await assets.removeFiles(ctx, removedPaths)
}

export function listCharRefs(ctx: AppContext, projectId: number) {
    projects.assertExists(ctx.db, projectId)
    return repo.charRefs.list(ctx.db, projectId).map(toCharRef)
}

/** Pads the image onto the closest director-reference canvas NovelAI expects. */
export async function processCharacterImage(data: Uint8Array) {
    const metadata = await sharp(data, { limitInputPixels: assets.MAX_INPUT_PIXELS }).metadata()
    const aspect = (metadata.width ?? 1024) / (metadata.height ?? 1024)
    const best = DIRECTOR_DIMENSIONS.reduce((current, candidate) =>
        Math.abs(aspect - candidate.width / candidate.height) <
        Math.abs(aspect - current.width / current.height)
            ? candidate
            : current,
    )
    return assets.encodeImage(data, { saveType: { type: 'png' }, contain: best })
}

export async function uploadCharRef(ctx: AppContext, projectId: number, file: Blob) {
    projects.assertExists(ctx.db, projectId)
    const upload = await assets.readUploadedImage(file)
    const relDir = charDir(projectId)
    const prepared: assets.PreparedAsset[] = []
    try {
        prepared.push(await assets.prepareUpload(ctx, upload, { kind: 'char_ref_source', relDir }))
        prepared.push(
            await assets.prepareImage(ctx, upload.data, {
                kind: 'char_ref_thumb',
                relDir,
                saveType: { type: 'png' },
                maxSize: CHAR_REF_THUMB_SIZE,
            }),
        )
        const processed = await processCharacterImage(upload.data)
        prepared.push(
            await assets.prepare(ctx, {
                kind: 'char_ref_processed',
                relDir,
                data: processed.data,
                extension: 'png',
                width: processed.width,
                height: processed.height,
            }),
        )

        return ctx.db.transaction((tx) => {
            projects.assertExists(tx, projectId)
            const [source, thumb, processedAsset] = prepared.map((item) =>
                assets.insertPrepared(tx, item),
            )
            const row = repo.charRefs.insert(tx, {
                projectId,
                position: keyAfter(repo.charRefs.lastPosition(tx, projectId)),
                sourceAssetId: source!.id,
                thumbAssetId: thumb!.id,
                processedAssetId: processedAsset!.id,
                ...DEFAULT_CHAR_REF,
                enabled: true,
            })
            return toCharRef(row)
        })
    } catch (error) {
        await assets.discard(ctx, prepared)
        throw error
    }
}

export function updateCharRef(ctx: AppContext, id: number, patch: CharacterReferencePatch) {
    return ctx.db.transaction((tx) => {
        requireEntity(repo.charRefs.get(tx, id), 'Character reference')
        return toCharRef(requireEntity(repo.charRefs.update(tx, id, patch), 'Character reference'))
    })
}

export function moveCharRef(ctx: AppContext, id: number, body: MoveBody) {
    return ctx.db.transaction((tx) => {
        const row = requireEntity(repo.charRefs.get(tx, id), 'Character reference')
        let updates
        try {
            updates = planMove(
                repo.charRefs.list(tx, row.projectId),
                id,
                body.beforeId,
                body.afterId,
            )
        } catch (error) {
            throw scenes.moveError(error, 'Character reference')
        }
        for (const update of updates) {
            repo.charRefs.update(tx, update.id, { position: update.position })
        }
        return toCharRef(requireEntity(repo.charRefs.get(tx, id), 'Character reference'))
    })
}

export async function removeCharRef(ctx: AppContext, id: number) {
    const removedPaths = ctx.db.transaction((tx) => {
        const row = requireEntity(repo.charRefs.get(tx, id), 'Character reference')
        repo.charRefs.remove(tx, id)
        return assets.deleteUnreferenced(tx, [
            row.sourceAssetId,
            row.thumbAssetId,
            row.processedAssetId,
        ])
    })
    await assets.removeFiles(ctx, removedPaths)
}

export function vibeRows(db: DbOrTx, projectId: number) {
    return repo.vibes.list(db, projectId)
}

export function charRefRows(db: DbOrTx, projectId: number) {
    return repo.charRefs.list(db, projectId)
}

export function insertVibeRow(tx: DbOrTx, values: repo.VibeInsert) {
    return repo.vibes.insert(tx, values)
}

export function insertCharRefRow(tx: DbOrTx, values: repo.CharRefInsert) {
    return repo.charRefs.insert(tx, values)
}

/** Copies references into another project, sharing the stored files. */
export function copyProjectReferences(tx: DbOrTx, fromProjectId: number, toProjectId: number) {
    for (const { id: _, createdAt: __, updatedAt: ___, ...row } of repo.vibes.list(
        tx,
        fromProjectId,
    )) {
        repo.vibes.insert(tx, {
            ...row,
            projectId: toProjectId,
            cacheKey: null,
            cacheCreatedAt: null,
        })
    }
    for (const { id: _, createdAt: __, updatedAt: ___, ...row } of repo.charRefs.list(
        tx,
        fromProjectId,
    )) {
        repo.charRefs.insert(tx, {
            ...row,
            projectId: toProjectId,
            cacheKey: null,
            cacheCreatedAt: null,
        })
    }
}

/** References prepared for one generation, plus the cache entries to record on success. */
export type PreparedReferences = {
    vibes: VibeReference[]
    characterReferences: CharacterReferenceInput[]
    uploads: {
        vibes: { id: number; cacheKey: string }[]
        charRefs: { id: number; cacheKey: string }[]
    }
}

async function ensureVibeEncoding(
    ctx: AppContext,
    row: repo.VibeRow,
    model: NovelAIModel,
    apiKey: string,
    signal?: AbortSignal,
) {
    if (isEncodingCurrent(row, model) && row.encodedAssetId !== null) {
        return { row, data: (await assets.read(ctx, row.encodedAssetId)).data }
    }

    const source = await assets.read(ctx, row.sourceAssetId)
    const png = await assets.encodeImage(source.data, { saveType: { type: 'png' } })
    const encoded = await ctx.novelai.encodeVibe(
        apiKey,
        { image: png.data, informationExtracted: row.informationExtracted, model },
        { signal, context: { vibeTransferId: row.id } },
    )
    const prepared = await assets.prepare(ctx, {
        kind: 'vibe_encoded',
        relDir: vibeDir(row.projectId),
        data: encoded,
        extension: 'vibe',
    })

    try {
        const { updated, removedPaths } = ctx.db.transaction((tx) => {
            const current = repo.vibes.get(tx, row.id)
            if (!current) return { updated: null, removedPaths: [] }
            const asset = assets.insertPrepared(tx, prepared)
            const updated = repo.vibes.update(tx, row.id, {
                encodedAssetId: asset.id,
                encodedForModel: model,
                encodedInformationExtracted: current.informationExtracted,
                // A new encoding must be uploaded again.
                cacheKey: null,
                cacheCreatedAt: null,
            })
            return {
                updated,
                removedPaths: assets.deleteUnreferenced(tx, [current.encodedAssetId]),
            }
        })
        await assets.removeFiles(ctx, removedPaths)
        if (!updated) await assets.discard(ctx, [prepared])
        return { row: updated ?? row, data: encoded }
    } catch (error) {
        await assets.discard(ctx, [prepared])
        throw error
    }
}

async function ensureProcessed(ctx: AppContext, row: repo.CharRefRow) {
    if (row.processedAssetId !== null) {
        return (await assets.read(ctx, row.processedAssetId)).data
    }
    const source = await assets.read(ctx, row.sourceAssetId)
    const processed = await processCharacterImage(source.data)
    const prepared = await assets.prepare(ctx, {
        kind: 'char_ref_processed',
        relDir: charDir(row.projectId),
        data: processed.data,
        extension: 'png',
        width: processed.width,
        height: processed.height,
    })
    try {
        ctx.db.transaction((tx) => {
            const asset = assets.insertPrepared(tx, prepared)
            repo.charRefs.update(tx, row.id, { processedAssetId: asset.id })
        })
    } catch (error) {
        await assets.discard(ctx, [prepared])
        throw error
    }
    return processed.data
}

/** Encodes vibes when needed and reattaches files whose NovelAI cache entry expired. */
export async function prepareForGeneration(
    ctx: AppContext,
    projectId: number,
    model: NovelAIModel,
    apiKey: string,
    signal?: AbortSignal,
): Promise<PreparedReferences> {
    const result: PreparedReferences = {
        vibes: [],
        characterReferences: [],
        uploads: { vibes: [], charRefs: [] },
    }

    for (const [index, initial] of repo.vibes
        .list(ctx.db, projectId)
        .filter((row) => row.enabled)
        .entries()) {
        const { row, data } = await ensureVibeEncoding(ctx, initial, model, apiKey, signal)
        const fresh = isCacheFresh(row.cacheKey, row.cacheCreatedAt)
        const cacheKey = fresh && row.cacheKey ? row.cacheKey : newCacheKey()
        result.vibes.push({
            cacheKey,
            strength: row.referenceStrength,
            informationExtracted: row.encodedInformationExtracted ?? row.informationExtracted,
            ...(fresh
                ? {}
                : {
                      upload: {
                          fieldName: `ref_multiple_${index}`,
                          data,
                          contentType: 'image/png',
                      },
                  }),
        })
        if (!fresh) result.uploads.vibes.push({ id: row.id, cacheKey })
    }

    for (const [index, row] of repo.charRefs
        .list(ctx.db, projectId)
        .filter((ref) => ref.enabled)
        .entries()) {
        const fresh = isCacheFresh(row.cacheKey, row.cacheCreatedAt)
        const cacheKey = fresh && row.cacheKey ? row.cacheKey : newCacheKey()
        const upload = fresh
            ? undefined
            : {
                  fieldName: `director_ref_${index}`,
                  data: await ensureProcessed(ctx, row),
                  contentType: 'image/png',
              }
        result.characterReferences.push({
            cacheKey,
            strength: row.strength,
            fidelity: row.fidelity,
            mode: row.mode,
            ...(upload ? { upload } : {}),
        })
        if (!fresh) result.uploads.charRefs.push({ id: row.id, cacheKey })
    }

    return result
}

export function hasEnabledCharacterReferences(db: DbOrTx, projectId: number) {
    return repo.charRefs.list(db, projectId).some((row) => row.enabled)
}

/** Records uploaded cache entries; runs in the transaction that saves the generated image. */
export function markUploaded(tx: DbOrTx, uploads: PreparedReferences['uploads'], at = new Date()) {
    repo.vibes.markUploaded(tx, uploads.vibes, at)
    repo.charRefs.markUploaded(tx, uploads.charRefs, at)
}
