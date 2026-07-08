import { createHash } from 'node:crypto'
import { basename, extname, join } from 'node:path'
import {
    DEFAULT_PROJECT_ARCHIVE_INCLUDE_OPTIONS,
    DEFAULT_PROJECT_PARAMETERS,
    DEFAULT_PROJECT_SETTINGS,
    PROJECT_ARCHIVE_EXTENSION,
    PROJECT_ARCHIVE_FORMAT,
    PROJECT_ARCHIVE_FORMAT_VERSION,
    type ProjectArchiveAsset,
    type ProjectArchiveAssetKind,
    type ProjectArchiveExportBody,
    type ProjectArchiveImportBody,
    ProjectArchiveIncludeOptions,
    ProjectArchiveManifest,
    type ProjectArchiveScene,
} from '@nai-factory/shared'
import { asc, eq, inArray } from 'drizzle-orm'
import { unzipSync, zipSync } from 'fflate'
import { envConfig } from '@/config'
import * as dataStorage from '@/data'
import {
    characterReferences,
    db,
    images,
    projects,
    scenes,
    sceneVariations,
    vibeTransfers,
} from '@/db'
import logger from '@/logger'
import { type AssetKind, createAsset } from '@/services/app/assets'
import { httpError, requireEntity, withNormalizedVariables } from '@/utils'

const log = logger.child({ module: 'project-archive-service' })

type PendingWrite = {
    path: string
    data: Uint8Array
}

type PendingAssetUpdate =
    | {
          table: 'images'
          id: number
          field: 'assetId' | 'thumbnailAssetId'
          kind: AssetKind
          path: string
      }
    | {
          table: 'characterReferences'
          id: number
          field: 'sourceAssetId' | 'thumbnailAssetId' | 'processedAssetId'
          kind: AssetKind
          path: string
      }
    | { table: 'vibeTransfers'; id: number; field: 'sourceAssetId'; kind: AssetKind; path: string }

type ArchiveAssetFile = {
    asset: ProjectArchiveAsset
    data: Uint8Array
}

function metadataRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return value as Record<string, unknown>
}

function normalizeProject<T extends typeof projects.$inferSelect>(project: T) {
    const normalized = withNormalizedVariables(project)
    return {
        ...normalized,
        settings: {
            ...DEFAULT_PROJECT_SETTINGS,
            ...(normalized.settings ?? {}),
        },
    }
}

async function getProjectById(projectId: number) {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId))
    return normalizeProject(requireEntity(project, 'Project not found'))
}

function archiveLocalId(prefix: string, id: number) {
    return `${prefix}-${id}`
}

function normalizeArchivePath(path: string) {
    return path.replaceAll('\\', '/')
}

function contentTypeForPath(path: string) {
    const lower = path.toLowerCase()
    if (lower.endsWith('.png')) return 'image/png'
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
    if (lower.endsWith('.webp')) return 'image/webp'
    if (lower.endsWith('.avif')) return 'image/avif'
    return 'application/octet-stream'
}

function sha256(data: Uint8Array) {
    return createHash('sha256').update(data).digest('hex')
}

function sanitizeFilename(value: string) {
    const sanitized = value
        .replace(/[\\/:*?"<>|]/g, '-')
        .split('')
        .map((char) => (char.charCodeAt(0) < 32 ? '-' : char))
        .join('')
        .replace(/\s+/g, ' ')
        .replace(/-+/g, '-')
        .trim()
        .replace(/^[.\s-]+|[.\s-]+$/g, '')

    return sanitized || 'asset'
}

function archiveAssetPath(kind: ProjectArchiveAssetKind, ownerId: number, sourcePath: string) {
    const filename = sanitizeFilename(`${ownerId}-${basename(sourcePath)}`)
    return normalizeArchivePath(join('assets', kind, filename))
}

function normalizeArchiveIncludeOptions(
    include: Partial<ProjectArchiveIncludeOptions> = {},
): ProjectArchiveIncludeOptions {
    return ProjectArchiveIncludeOptions.parse({
        ...DEFAULT_PROJECT_ARCHIVE_INCLUDE_OPTIONS,
        ...include,
    })
}

async function createArchiveAssetFile({
    assetId,
    kind,
    ownerId,
    sourcePath,
}: {
    assetId: string
    kind: ProjectArchiveAssetKind
    ownerId: number
    sourcePath: string | null
}): Promise<ArchiveAssetFile | null> {
    if (!sourcePath) return null
    if (!(await dataStorage.exists(sourcePath))) {
        log.warn({ sourcePath, kind, ownerId }, 'Archive asset source is missing')
        return null
    }

    const data = new Uint8Array(await dataStorage.readFile(sourcePath))
    return {
        asset: {
            id: assetId,
            kind,
            path: archiveAssetPath(kind, ownerId, sourcePath),
            filename: basename(sourcePath),
            contentType: contentTypeForPath(sourcePath),
            size: data.byteLength,
            sha256: sha256(data),
        },
        data,
    }
}

export async function createProjectArchive(projectId: number, body: ProjectArchiveExportBody) {
    const source = await getProjectById(projectId)
    const include = normalizeArchiveIncludeOptions(body.include)
    const archiveFiles: ArchiveAssetFile[] = []
    const archiveScenes: ProjectArchiveScene[] = []

    const sourceScenes = include.scenes
        ? await db
              .select()
              .from(scenes)
              .where(eq(scenes.projectId, projectId))
              .orderBy(asc(scenes.displayOrder), asc(scenes.id))
        : []
    const sceneIds = sourceScenes.map((scene) => scene.id)

    const sourceVariations =
        include.scenes && include.sceneVariations && sceneIds.length > 0
            ? await db
                  .select()
                  .from(sceneVariations)
                  .where(inArray(sceneVariations.sceneId, sceneIds))
                  .orderBy(asc(sceneVariations.sceneId), asc(sceneVariations.displayOrder))
            : []

    const sourceImages =
        include.scenes && include.images && sceneIds.length > 0
            ? await db
                  .select()
                  .from(images)
                  .where(inArray(images.sceneId, sceneIds))
                  .orderBy(asc(images.sceneId), asc(images.displayOrder), asc(images.id))
            : []

    const variationsBySceneId = new Map<number, typeof sourceVariations>()
    for (const variation of sourceVariations) {
        const rows = variationsBySceneId.get(variation.sceneId) ?? []
        rows.push(variation)
        variationsBySceneId.set(variation.sceneId, rows)
    }

    const imagesBySceneId = new Map<number, typeof sourceImages>()
    for (const image of sourceImages) {
        const rows = imagesBySceneId.get(image.sceneId) ?? []
        rows.push(image)
        imagesBySceneId.set(image.sceneId, rows)
    }

    for (const scene of sourceScenes) {
        const archiveImages: ProjectArchiveScene['images'] = []
        for (const image of imagesBySceneId.get(scene.id) ?? []) {
            const imageAsset = await createArchiveAssetFile({
                assetId: `image-${image.id}`,
                kind: 'image',
                ownerId: image.id,
                sourcePath: image.filePath,
            })
            if (imageAsset) archiveFiles.push(imageAsset)

            const thumbnailAsset = include.thumbnails
                ? await createArchiveAssetFile({
                      assetId: `image-thumbnail-${image.id}`,
                      kind: 'image-thumbnail',
                      ownerId: image.id,
                      sourcePath: image.thumbnailPath,
                  })
                : null
            if (thumbnailAsset) archiveFiles.push(thumbnailAsset)

            archiveImages.push({
                localId: archiveLocalId('image', image.id),
                displayOrder: image.displayOrder,
                assetId: imageAsset?.asset.id,
                thumbnailAssetId: thumbnailAsset?.asset.id,
                metadata: include.imageMetadata ? metadataRecord(image.metadata) : {},
                createdAt: image.createdAt,
                originalId: image.id,
            })
        }

        archiveScenes.push({
            localId: archiveLocalId('scene', scene.id),
            name: scene.name,
            displayOrder: scene.displayOrder,
            variations: (variationsBySceneId.get(scene.id) ?? []).map((variation) => ({
                localId: archiveLocalId('scene-variation', variation.id),
                displayOrder: variation.displayOrder,
                variables: variation.variables,
                originalId: variation.id,
            })),
            images: archiveImages,
            createdAt: scene.createdAt,
            updatedAt: scene.updatedAt,
            originalId: scene.id,
        })
    }

    const sourceCharacterReferences = include.characterReferences
        ? await db
              .select()
              .from(characterReferences)
              .where(eq(characterReferences.projectId, projectId))
              .orderBy(asc(characterReferences.displayOrder), asc(characterReferences.id))
        : []

    const archiveCharacterReferences = []
    for (const ref of sourceCharacterReferences) {
        const sourceAsset = await createArchiveAssetFile({
            assetId: `character-reference-source-${ref.id}`,
            kind: 'character-reference-source',
            ownerId: ref.id,
            sourcePath: ref.sourceImagePath,
        })
        if (sourceAsset) archiveFiles.push(sourceAsset)

        const thumbnailAsset = include.thumbnails
            ? await createArchiveAssetFile({
                  assetId: `character-reference-thumbnail-${ref.id}`,
                  kind: 'character-reference-thumbnail',
                  ownerId: ref.id,
                  sourcePath: ref.thumbnailPath,
              })
            : null
        if (thumbnailAsset) archiveFiles.push(thumbnailAsset)

        const processedAsset = include.derivedCaches
            ? await createArchiveAssetFile({
                  assetId: `character-reference-processed-${ref.id}`,
                  kind: 'character-reference-processed',
                  ownerId: ref.id,
                  sourcePath: ref.processedImagePath,
              })
            : null
        if (processedAsset) archiveFiles.push(processedAsset)

        archiveCharacterReferences.push({
            localId: archiveLocalId('character-reference', ref.id),
            displayOrder: ref.displayOrder,
            sourceAssetId: sourceAsset?.asset.id,
            thumbnailAssetId: thumbnailAsset?.asset.id,
            processedAssetId: processedAsset?.asset.id,
            strength: ref.strength,
            fidelity: ref.fidelity,
            referenceMode: ref.referenceMode,
            enabled: ref.enabled,
            createdAt: ref.createdAt,
            updatedAt: ref.updatedAt,
            originalId: ref.id,
        })
    }

    const sourceVibeTransfers = include.vibeTransfers
        ? await db
              .select()
              .from(vibeTransfers)
              .where(eq(vibeTransfers.projectId, projectId))
              .orderBy(asc(vibeTransfers.displayOrder), asc(vibeTransfers.id))
        : []

    const archiveVibeTransfers = []
    for (const vibe of sourceVibeTransfers) {
        const sourceAsset = await createArchiveAssetFile({
            assetId: `vibe-source-${vibe.id}`,
            kind: 'vibe-source',
            ownerId: vibe.id,
            sourcePath: vibe.sourceImagePath,
        })
        if (sourceAsset) archiveFiles.push(sourceAsset)

        archiveVibeTransfers.push({
            localId: archiveLocalId('vibe-transfer', vibe.id),
            displayOrder: vibe.displayOrder,
            sourceAssetId: sourceAsset?.asset.id,
            referenceStrength: vibe.referenceStrength,
            informationExtracted: vibe.informationExtracted,
            encodedData: include.derivedCaches ? vibe.encodedData : undefined,
            encodedInformationExtracted: include.derivedCaches
                ? vibe.encodedInformationExtracted
                : undefined,
            createdAt: vibe.createdAt,
            updatedAt: vibe.updatedAt,
            originalId: vibe.id,
        })
    }

    const manifest = ProjectArchiveManifest.parse({
        format: PROJECT_ARCHIVE_FORMAT,
        formatVersion: PROJECT_ARCHIVE_FORMAT_VERSION,
        exportedAt: new Date().toISOString(),
        include,
        project: {
            name: source.name,
            prompt: include.projectPrompt ? source.prompt : undefined,
            negativePrompt: include.projectPrompt ? source.negativePrompt : undefined,
            variables: include.projectVariables ? source.variables : undefined,
            parameters: include.projectParameters ? source.parameters : undefined,
            characterPrompts: include.characterPrompts ? source.characterPrompts : undefined,
            settings: include.projectSettings ? source.settings : undefined,
            createdAt: source.createdAt,
            updatedAt: source.updatedAt,
            originalId: source.id,
        },
        scenes: archiveScenes,
        characterReferences: archiveCharacterReferences,
        vibeTransfers: archiveVibeTransfers,
        assets: archiveFiles.map((file) => file.asset),
    })

    const entries: Record<string, Uint8Array> = {
        'manifest.json': new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
    }
    for (const file of archiveFiles) {
        entries[file.asset.path] = file.data
    }

    const archive = zipSync(entries)
    const filename = `${sanitizeFilename(source.name)}.${PROJECT_ARCHIVE_EXTENSION}`

    log.info(
        {
            event: 'project.archive.created',
            projectId,
            assetCount: manifest.assets.length,
            sceneCount: manifest.scenes.length,
        },
        'Project archive created',
    )

    return { archive, filename }
}

function parseArchiveEntries(data: Uint8Array) {
    try {
        return unzipSync(data)
    } catch (error) {
        throw httpError(400, error instanceof Error ? error.message : 'Invalid project archive')
    }
}

function parseArchiveManifest(entries: Record<string, Uint8Array>) {
    const manifestEntry = entries['manifest.json']
    if (!manifestEntry) throw httpError(400, 'Archive manifest is missing')

    try {
        return ProjectArchiveManifest.parse(JSON.parse(new TextDecoder().decode(manifestEntry)))
    } catch (error) {
        throw httpError(400, error instanceof Error ? error.message : 'Invalid archive manifest')
    }
}

function assetExtension(asset: ProjectArchiveAsset) {
    return extname(asset.filename) || extname(asset.path) || '.png'
}

function normalizedStoragePath(...parts: string[]) {
    return join(...parts).replaceAll('\\', '/')
}

function buildAssetReader(manifest: ProjectArchiveManifest, entries: Record<string, Uint8Array>) {
    const assetsById = new Map(manifest.assets.map((asset) => [asset.id, asset]))

    return (assetId: string | undefined) => {
        if (!assetId) return null

        const asset = assetsById.get(assetId)
        if (!asset) throw httpError(400, `Archive asset not found: ${assetId}`)

        const data = entries[normalizeArchivePath(asset.path)]
        if (!data) throw httpError(400, `Archive asset data is missing: ${asset.path}`)
        if (asset.size !== undefined && asset.size !== data.byteLength) {
            throw httpError(400, `Archive asset size mismatch: ${asset.path}`)
        }
        if (asset.sha256 && asset.sha256 !== sha256(data)) {
            throw httpError(400, `Archive asset checksum mismatch: ${asset.path}`)
        }

        return { asset, data }
    }
}

async function writePendingFiles(pendingWrites: PendingWrite[]) {
    try {
        await Promise.all(pendingWrites.map((file) => dataStorage.writeFile(file.path, file.data)))
    } catch (error) {
        await Promise.allSettled(pendingWrites.map((file) => dataStorage.remove(file.path)))
        throw error
    }
}

async function applyPendingAssetUpdates(updates: PendingAssetUpdate[]) {
    for (const update of updates) {
        const asset = await createAsset(update.kind, update.path)
        if (update.table === 'images') {
            db.update(images)
                .set({ [update.field]: asset.id })
                .where(eq(images.id, update.id))
                .run()
        } else if (update.table === 'characterReferences') {
            db.update(characterReferences)
                .set({ [update.field]: asset.id })
                .where(eq(characterReferences.id, update.id))
                .run()
        } else {
            db.update(vibeTransfers)
                .set({ sourceAssetId: asset.id })
                .where(eq(vibeTransfers.id, update.id))
                .run()
        }
    }
}

export async function importProjectArchive(file: ProjectArchiveImportBody['archive']) {
    const entries = parseArchiveEntries(new Uint8Array(await file.arrayBuffer()))
    const manifest = parseArchiveManifest(entries)
    const readAsset = buildAssetReader(manifest, entries)
    const pendingWrites: PendingWrite[] = []
    const pendingAssetUpdates: PendingAssetUpdate[] = []

    const project = db.transaction(() => {
        const createdProject = db
            .insert(projects)
            .values({
                groupId: null,
                name: manifest.project.name,
                prompt: manifest.project.prompt ?? '',
                negativePrompt: manifest.project.negativePrompt ?? '',
                variables: manifest.project.variables ?? [],
                parameters: manifest.project.parameters ?? DEFAULT_PROJECT_PARAMETERS,
                characterPrompts: manifest.project.characterPrompts ?? [],
                settings: {
                    ...DEFAULT_PROJECT_SETTINGS,
                    ...(manifest.project.settings ?? {}),
                },
            })
            .returning()
            .get()
        if (!createdProject) throw httpError(500, 'Failed to import project')

        for (const archiveScene of manifest.scenes) {
            const scene = db
                .insert(scenes)
                .values({
                    projectId: createdProject.id,
                    displayOrder: archiveScene.displayOrder,
                    name: archiveScene.name,
                    ...(archiveScene.createdAt ? { createdAt: archiveScene.createdAt } : {}),
                    ...(archiveScene.updatedAt ? { updatedAt: archiveScene.updatedAt } : {}),
                })
                .returning()
                .get()
            if (!scene) throw httpError(500, 'Failed to import scene')

            if (archiveScene.variations.length > 0) {
                db.insert(sceneVariations)
                    .values(
                        archiveScene.variations.map((variation) => ({
                            sceneId: scene.id,
                            displayOrder: variation.displayOrder,
                            variables: variation.variables,
                        })),
                    )
                    .run()
            }

            for (const archiveImage of archiveScene.images) {
                const imageAsset = readAsset(archiveImage.assetId)
                if (!imageAsset) continue

                const image = db
                    .insert(images)
                    .values({
                        sceneId: scene.id,
                        displayOrder: archiveImage.displayOrder,
                        filePath: 'pending-import',
                        thumbnailPath: null,
                        metadata: archiveImage.metadata,
                        ...(archiveImage.createdAt ? { createdAt: archiveImage.createdAt } : {}),
                    })
                    .returning()
                    .get()
                if (!image) throw httpError(500, 'Failed to import image')

                const filePath = normalizedStoragePath(
                    envConfig.NAI_FACTORY_IMAGES_DIR,
                    String(createdProject.id),
                    String(scene.id),
                    `${image.id}${assetExtension(imageAsset.asset)}`,
                )
                const thumbnailAsset = readAsset(archiveImage.thumbnailAssetId)
                const thumbnailPath = thumbnailAsset
                    ? normalizedStoragePath(
                          envConfig.NAI_FACTORY_THUMBNAILS_DIR,
                          String(createdProject.id),
                          String(scene.id),
                          `${image.id}${assetExtension(thumbnailAsset.asset)}`,
                      )
                    : null

                db.update(images)
                    .set({ filePath, thumbnailPath })
                    .where(eq(images.id, image.id))
                    .run()
                pendingWrites.push({ path: filePath, data: imageAsset.data })
                pendingAssetUpdates.push({
                    table: 'images',
                    id: image.id,
                    field: 'assetId',
                    kind: 'image',
                    path: filePath,
                })
                if (thumbnailAsset && thumbnailPath) {
                    const path = thumbnailPath
                    pendingWrites.push({ path, data: thumbnailAsset.data })
                    pendingAssetUpdates.push({
                        table: 'images',
                        id: image.id,
                        field: 'thumbnailAssetId',
                        kind: 'image-thumbnail',
                        path,
                    })
                }
            }
        }

        for (const archiveReference of manifest.characterReferences) {
            const sourceAsset = readAsset(archiveReference.sourceAssetId)
            if (!sourceAsset) continue

            const reference = db
                .insert(characterReferences)
                .values({
                    projectId: createdProject.id,
                    displayOrder: archiveReference.displayOrder,
                    sourceImagePath: 'pending-import',
                    thumbnailPath: null,
                    processedImagePath: null,
                    strength: archiveReference.strength,
                    fidelity: archiveReference.fidelity,
                    referenceMode: archiveReference.referenceMode,
                    enabled: archiveReference.enabled,
                    ...(archiveReference.createdAt
                        ? { createdAt: archiveReference.createdAt }
                        : {}),
                    ...(archiveReference.updatedAt
                        ? { updatedAt: archiveReference.updatedAt }
                        : {}),
                })
                .returning()
                .get()
            if (!reference) throw httpError(500, 'Failed to import character reference')

            const sourceImagePath = normalizedStoragePath(
                envConfig.NAI_FACTORY_CHARACTER_REFERENCES_DIR,
                String(createdProject.id),
                `${reference.id}-source${assetExtension(sourceAsset.asset)}`,
            )
            const thumbnailAsset = readAsset(archiveReference.thumbnailAssetId)
            const thumbnailPath = thumbnailAsset
                ? normalizedStoragePath(
                      envConfig.NAI_FACTORY_CHARACTER_REFERENCES_DIR,
                      String(createdProject.id),
                      `${reference.id}-thumbnail${assetExtension(thumbnailAsset.asset)}`,
                  )
                : null
            const processedAsset = readAsset(archiveReference.processedAssetId)
            const processedImagePath = processedAsset
                ? normalizedStoragePath(
                      envConfig.NAI_FACTORY_CHARACTER_REFERENCES_DIR,
                      String(createdProject.id),
                      `${reference.id}-processed${assetExtension(processedAsset.asset)}`,
                  )
                : null

            db.update(characterReferences)
                .set({ sourceImagePath, thumbnailPath, processedImagePath })
                .where(eq(characterReferences.id, reference.id))
                .run()
            pendingWrites.push({ path: sourceImagePath, data: sourceAsset.data })
            pendingAssetUpdates.push({
                table: 'characterReferences',
                id: reference.id,
                field: 'sourceAssetId',
                kind: 'character-reference-source',
                path: sourceImagePath,
            })
            if (thumbnailAsset && thumbnailPath) {
                const path = thumbnailPath
                pendingWrites.push({ path, data: thumbnailAsset.data })
                pendingAssetUpdates.push({
                    table: 'characterReferences',
                    id: reference.id,
                    field: 'thumbnailAssetId',
                    kind: 'character-reference-thumbnail',
                    path,
                })
            }
            if (processedAsset && processedImagePath) {
                const path = processedImagePath
                pendingWrites.push({ path, data: processedAsset.data })
                pendingAssetUpdates.push({
                    table: 'characterReferences',
                    id: reference.id,
                    field: 'processedAssetId',
                    kind: 'character-reference-processed',
                    path,
                })
            }
        }

        for (const archiveVibe of manifest.vibeTransfers) {
            const sourceAsset = readAsset(archiveVibe.sourceAssetId)
            if (!sourceAsset) continue

            const vibe = db
                .insert(vibeTransfers)
                .values({
                    projectId: createdProject.id,
                    displayOrder: archiveVibe.displayOrder,
                    sourceImagePath: 'pending-import',
                    referenceStrength: archiveVibe.referenceStrength,
                    informationExtracted: archiveVibe.informationExtracted,
                    encodedData: archiveVibe.encodedData,
                    encodedInformationExtracted: archiveVibe.encodedInformationExtracted,
                    ...(archiveVibe.createdAt ? { createdAt: archiveVibe.createdAt } : {}),
                    ...(archiveVibe.updatedAt ? { updatedAt: archiveVibe.updatedAt } : {}),
                })
                .returning()
                .get()
            if (!vibe) throw httpError(500, 'Failed to import vibe transfer')

            const sourceImagePath = normalizedStoragePath(
                envConfig.NAI_FACTORY_VIBES_DIR,
                String(createdProject.id),
                `${vibe.id}${assetExtension(sourceAsset.asset)}`,
            )
            db.update(vibeTransfers)
                .set({ sourceImagePath })
                .where(eq(vibeTransfers.id, vibe.id))
                .run()
            pendingWrites.push({ path: sourceImagePath, data: sourceAsset.data })
            pendingAssetUpdates.push({
                table: 'vibeTransfers',
                id: vibe.id,
                field: 'sourceAssetId',
                kind: 'vibe-source',
                path: sourceImagePath,
            })
        }

        return createdProject
    })

    try {
        await writePendingFiles(pendingWrites)
        await applyPendingAssetUpdates(pendingAssetUpdates)
    } catch (error) {
        await db.delete(projects).where(eq(projects.id, project.id))
        throw error
    }

    log.info(
        {
            event: 'project.archive.imported',
            projectId: project.id,
            sceneCount: manifest.scenes.length,
            assetCount: pendingWrites.length,
        },
        'Project archive imported',
    )

    return normalizeProject(project)
}
