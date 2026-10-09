import { randomUUID } from 'node:crypto'

import {
    type ArchiveAsset,
    type ArchiveExportBody,
    ArchiveManifest,
    type AssetKind,
    DEFAULT_ARCHIVE_INCLUDE,
    DEFAULT_PROJECT_PARAMETERS,
    PROJECT_ARCHIVE_EXTENSION,
    PROJECT_ARCHIVE_FORMAT,
    PROJECT_ARCHIVE_FORMAT_VERSION,
} from '@nai-factory/shared'

import { APP_VERSION } from '@/config'
import type { AppContext } from '@/context'
import { AppError, badRequest } from '@/lib/http'
import { contentTypeForPath } from '@/lib/mime'
import { readZipStream, ZipLimitError, type ZipEntry } from '@/lib/zip'
import * as assets from '@/modules/assets/service'
import * as images from '@/modules/images/service'
import * as projects from '@/modules/projects/service'
import * as references from '@/modules/references/service'
import * as scenes from '@/modules/scenes/service'

import { sanitizeFilename } from './filenames'

const MANIFEST_NAME = 'manifest.json'
const MAX_MANIFEST_BYTES = 32 * 1024 * 1024
const MAX_ARCHIVE_ENTRIES = 100_000
const COMPRESSIBLE_KINDS = new Set<AssetKind>(['vibe_encoded'])

function extensionOf(relPath: string) {
    const dot = relPath.lastIndexOf('.')
    const ext = dot === -1 ? 'bin' : relPath.slice(dot + 1).toLowerCase()
    return /^[a-z0-9]{1,8}$/.test(ext) ? ext : 'bin'
}

export function buildArchive(ctx: AppContext, projectId: number, body: ArchiveExportBody) {
    const include = { ...DEFAULT_ARCHIVE_INCLUDE, ...body.include }
    const project = projects.get(ctx, projectId)
    const files = new Map<number, ArchiveAsset>()

    const ref = (assetId: number | null) => {
        if (assetId === null) return null
        const existing = files.get(assetId)
        if (existing) return existing.id
        const row = assets.get(ctx, assetId)
        if (!row) return null
        const id = `a${files.size + 1}`
        files.set(assetId, {
            id,
            kind: row.kind,
            path: `assets/${row.kind}/${id}.${extensionOf(row.relPath)}`,
            sha256: row.sha256,
            size: row.sizeBytes,
        })
        return id
    }
    const requireRef = (assetId: number) => ref(assetId) as string

    const sceneRows = include.scenes ? scenes.sceneRows(ctx.db, projectId) : []
    const variations = scenes.variationRows(
        ctx.db,
        sceneRows.map((scene) => scene.id),
    )
    const archiveScenes = sceneRows.map((scene) => {
        const sceneVariations = variations.filter((variation) => variation.sceneId === scene.id)
        const variationIndex = new Map(sceneVariations.map((variation, i) => [variation.id, i]))
        return {
            name: scene.name,
            position: scene.position,
            variations: sceneVariations.map((variation) => ({
                position: variation.position,
                variables: variation.variables,
            })),
            images: include.images
                ? images.rowsByScene(ctx.db, scene.id).map((image) => ({
                      position: image.position,
                      variation:
                          image.variationId === null
                              ? null
                              : (variationIndex.get(image.variationId) ?? null),
                      assetId: requireRef(image.assetId),
                      thumbAssetId: requireRef(image.thumbAssetId),
                      seed: image.seed,
                      metadata: image.metadata,
                      createdAt: image.createdAt.toISOString(),
                  }))
                : [],
        }
    })

    const characterReferences = include.characterReferences
        ? references.charRefRows(ctx.db, projectId).map((row) => ({
              position: row.position,
              sourceAssetId: requireRef(row.sourceAssetId),
              thumbAssetId: ref(row.thumbAssetId),
              processedAssetId: ref(row.processedAssetId),
              strength: row.strength,
              fidelity: row.fidelity,
              mode: row.mode,
              enabled: row.enabled,
          }))
        : []

    const vibeTransfers = include.vibeTransfers
        ? references.vibeRows(ctx.db, projectId).map((row) => ({
              position: row.position,
              sourceAssetId: requireRef(row.sourceAssetId),
              encodedAssetId: ref(row.encodedAssetId),
              encodedForModel: row.encodedAssetId === null ? null : row.encodedForModel,
              encodedInformationExtracted:
                  row.encodedAssetId === null ? null : row.encodedInformationExtracted,
              referenceStrength: row.referenceStrength,
              informationExtracted: row.informationExtracted,
              enabled: row.enabled,
          }))
        : []

    const manifest = ArchiveManifest.parse({
        format: PROJECT_ARCHIVE_FORMAT,
        formatVersion: PROJECT_ARCHIVE_FORMAT_VERSION,
        appVersion: APP_VERSION,
        exportedAt: new Date().toISOString(),
        include,
        project: {
            name: project.name,
            prompt: include.prompts ? project.prompt : null,
            negativePrompt: include.prompts ? project.negativePrompt : null,
            variables: include.prompts ? project.variables : null,
            characterPrompts: include.prompts ? project.characterPrompts : null,
            parameters: include.parameters ? project.parameters : null,
            settings: project.settings,
        },
        scenes: archiveScenes,
        characterReferences,
        vibeTransfers,
        assets: [...files.values()],
    })

    return {
        manifest,
        files: [...files.entries()].map(([assetId, asset]) => ({ assetId, asset })),
        filename: `${sanitizeFilename(project.name)}.${PROJECT_ARCHIVE_EXTENSION}`,
    }
}

export async function* archiveEntries(
    ctx: AppContext,
    archive: ReturnType<typeof buildArchive>,
): AsyncGenerator<ZipEntry> {
    yield {
        name: MANIFEST_NAME,
        data: new TextEncoder().encode(JSON.stringify(archive.manifest, null, 2)),
        compress: true,
    }
    for (const file of archive.files) {
        const { data } = await assets.read(ctx, file.assetId)
        yield { name: file.asset.path, data, compress: COMPRESSIBLE_KINDS.has(file.asset.kind) }
    }
}

function checkEntryName(name: string) {
    if (name === MANIFEST_NAME) return
    if (!/^assets\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/.test(name) || name.includes('..')) {
        throw badRequest(`Invalid archive entry: ${name.slice(0, 200)}`)
    }
}

function importDir(kind: AssetKind, batch: string) {
    switch (kind) {
        case 'image':
            return `images/import-${batch}`
        case 'image_thumb':
            return `thumbs/import-${batch}`
        case 'playground_image':
        case 'playground_thumb':
            return `playground/import-${batch}`
        case 'vibe_source':
        case 'vibe_encoded':
            return `refs/vibe/import-${batch}`
        default:
            return `refs/char/import-${batch}`
    }
}

/** Verifies and stores every asset file before inserting all rows in one transaction. */
export async function importArchive(ctx: AppContext, file: Blob) {
    const batch = randomUUID()
    const stagingDir = `tmp/import-${batch}`
    const staged = new Map<string, { relPath: string; size: number; sha256: string }>()
    let manifestBytes: Uint8Array | null = null

    try {
        return await importStaged()
    } finally {
        await ctx.storage.removeDir(stagingDir)
    }

    async function importStaged() {
        try {
            await readZipStream(file.stream(), {
                maxEntries: MAX_ARCHIVE_ENTRIES,
                maxTotalBytes: ctx.config.archiveMaxUncompressedBytes,
                checkName: checkEntryName,
                async onEntry(name, data) {
                    if (name === MANIFEST_NAME) {
                        if (data.byteLength > MAX_MANIFEST_BYTES)
                            throw badRequest('Archive manifest is too large')
                        manifestBytes = data
                    } else {
                        // Spill each file to disk so large archives never sit in memory.
                        const relPath = `${stagingDir}/${staged.size}.${extensionOf(name)}`
                        await ctx.storage.writeFile(relPath, data)
                        staged.set(name, {
                            relPath,
                            size: data.byteLength,
                            sha256: assets.sha256(data),
                        })
                    }
                },
            })
        } catch (error) {
            if (error instanceof AppError) throw error
            if (error instanceof ZipLimitError)
                throw new AppError(413, 'payload_too_large', error.message)
            throw badRequest(
                `Invalid archive: ${error instanceof Error ? error.message : String(error)}`,
            )
        }

        if (!manifestBytes) throw badRequest('Archive manifest is missing')
        let manifest: ArchiveManifest
        try {
            manifest = ArchiveManifest.parse(JSON.parse(new TextDecoder().decode(manifestBytes)))
        } catch (error) {
            throw badRequest(
                'Invalid or unsupported archive manifest',
                error instanceof Error ? error.message : undefined,
            )
        }

        // Verify and store every referenced file before touching the database.
        const prepared = new Map<string, assets.PreparedAsset>()
        try {
            for (const asset of manifest.assets) {
                const entry = staged.get(asset.path)
                if (!entry) throw badRequest(`Archive file is missing: ${asset.path}`)
                if (entry.size !== asset.size || entry.sha256 !== asset.sha256) {
                    throw badRequest(`Archive file is corrupt: ${asset.path}`)
                }
                if (prepared.has(asset.id)) throw badRequest(`Duplicate archive asset: ${asset.id}`)
                const relPath = `${importDir(asset.kind, batch)}/${randomUUID()}.${extensionOf(asset.path)}`
                await ctx.storage.move(entry.relPath, relPath)
                staged.delete(asset.path)
                prepared.set(asset.id, {
                    kind: asset.kind,
                    relPath,
                    contentType: contentTypeForPath(relPath),
                    sizeBytes: entry.size,
                    width: null,
                    height: null,
                    sha256: entry.sha256,
                    encrypted: ctx.storage.encrypted,
                })
            }

            return ctx.db.transaction((tx) => {
                const inserted = new Map<string, number>()
                const assetId = (id: string | null, kinds: AssetKind[]) => {
                    if (id === null) return null
                    const existing = inserted.get(id)
                    if (existing !== undefined) return existing
                    const item = prepared.get(id)
                    if (!item) throw badRequest(`Unknown archive asset: ${id}`)
                    if (!kinds.includes(item.kind))
                        throw badRequest(`Archive asset ${id} has the wrong kind`)
                    const row = assets.insertPrepared(tx, item)
                    inserted.set(id, row.id)
                    return row.id
                }
                const requireAsset = (id: string, kinds: AssetKind[]) =>
                    assetId(id, kinds) as number

                const created = projects.insertImported(tx, {
                    name: manifest.project.name,
                    prompt: manifest.project.prompt ?? '',
                    negativePrompt: manifest.project.negativePrompt ?? '',
                    variables: manifest.project.variables ?? [],
                    characterPrompts: manifest.project.characterPrompts ?? [],
                    parameters: manifest.project.parameters ?? DEFAULT_PROJECT_PARAMETERS,
                    settings: manifest.project.settings,
                })

                for (const archiveScene of manifest.scenes) {
                    const { scene, variations } = scenes.insertImported(
                        tx,
                        created.id,
                        archiveScene,
                    )
                    for (const image of archiveScene.images) {
                        images.insertRow(tx, {
                            sceneId: scene.id,
                            variationId:
                                image.variation === null
                                    ? null
                                    : (variations[image.variation]?.id ?? null),
                            position: image.position,
                            assetId: requireAsset(image.assetId, ['image']),
                            thumbAssetId: requireAsset(image.thumbAssetId, ['image_thumb']),
                            seed: image.seed,
                            metadata: image.metadata,
                            createdAt: new Date(image.createdAt),
                        })
                    }
                }

                for (const ref of manifest.characterReferences) {
                    references.insertCharRefRow(tx, {
                        projectId: created.id,
                        position: ref.position,
                        sourceAssetId: requireAsset(ref.sourceAssetId, ['char_ref_source']),
                        thumbAssetId: assetId(ref.thumbAssetId, ['char_ref_thumb']),
                        processedAssetId: assetId(ref.processedAssetId, ['char_ref_processed']),
                        strength: ref.strength,
                        fidelity: ref.fidelity,
                        mode: ref.mode,
                        enabled: ref.enabled,
                    })
                }

                for (const vibe of manifest.vibeTransfers) {
                    references.insertVibeRow(tx, {
                        projectId: created.id,
                        position: vibe.position,
                        sourceAssetId: requireAsset(vibe.sourceAssetId, ['vibe_source']),
                        encodedAssetId: assetId(vibe.encodedAssetId, ['vibe_encoded']),
                        encodedForModel: vibe.encodedForModel,
                        encodedInformationExtracted: vibe.encodedInformationExtracted,
                        referenceStrength: vibe.referenceStrength,
                        informationExtracted: vibe.informationExtracted,
                        enabled: vibe.enabled,
                    })
                }

                ctx.log.info(
                    { event: 'archive.imported', projectId: created.id, assets: prepared.size },
                    'Project archive imported',
                )
                return projects.toEntity(created)
            })
        } catch (error) {
            await assets.discard(ctx, [...prepared.values()])
            throw error
        }
    }
}
