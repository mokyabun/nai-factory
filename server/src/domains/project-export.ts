import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import { basename, extname, join, parse } from 'node:path'
import { zValidator } from '@hono/zod-validator'
import {
    DEFAULT_PROJECT_ARCHIVE_INCLUDE_OPTIONS,
    DEFAULT_PROJECT_SETTINGS,
    PROJECT_ARCHIVE_EXTENSION,
    PROJECT_ARCHIVE_FORMAT,
    PROJECT_ARCHIVE_FORMAT_VERSION,
    type ProjectArchiveAsset,
    type ProjectArchiveAssetKind,
    ProjectArchiveExportBody,
    ProjectArchiveIncludeOptions,
    ProjectArchiveManifest,
    type ProjectArchiveScene,
    ProjectExportBody,
    ProjectIdParams,
} from '@nai-factory/shared'
import { asc, desc, eq, inArray } from 'drizzle-orm'
import { zipSync } from 'fflate'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
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
import * as settingsService from '@/services/app/settings'
import { requireEntity, withNormalizedVariables } from '@/utils'

const log = logger.child({ module: 'project-export-domain' })

type ExportAsset = {
    id: number
    sceneId: number
    sceneName: string
    filePath: string
    filename: string
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

function fileExtension(filePath: string) {
    return extname(filePath).replace(/^\./, '') || 'png'
}

function renderOutputTemplate(
    template: string,
    values: { character: string; scene: string; number: number; extension: string },
) {
    const rendered = template
        .replaceAll('{character}', values.character)
        .replaceAll('{scene}', values.scene)
        .replaceAll('{number}', String(values.number))
        .replaceAll('{extension}', values.extension)

    const sanitized = sanitizeFilename(rendered)
    if (extname(sanitized)) return sanitized

    return `${sanitized}.${values.extension}`
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

function uniqueFilename(filename: string, used: Map<string, number>) {
    const count = used.get(filename) ?? 0
    used.set(filename, count + 1)
    if (count === 0) return filename

    const parsed = parse(filename)
    return `${parsed.name}-${count + 1}${parsed.ext}`
}

function contentDisposition(filename: string) {
    const fallback = filename
        .split('')
        .map((char) => {
            const code = char.charCodeAt(0)
            return code >= 32 && code < 127 && char !== '"' && char !== '\\' ? char : '_'
        })
        .join('')

    return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

function normalizeArchiveIncludeOptions(
    include: Partial<ProjectArchiveIncludeOptions> = {},
): ProjectArchiveIncludeOptions {
    return ProjectArchiveIncludeOptions.parse({
        ...DEFAULT_PROJECT_ARCHIVE_INCLUDE_OPTIONS,
        ...include,
    })
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

function archiveAssetPath(kind: ProjectArchiveAssetKind, ownerId: number, sourcePath: string) {
    const filename = sanitizeFilename(`${ownerId}-${basename(sourcePath)}`)
    return normalizeArchivePath(join('assets', kind, filename))
}

type ArchiveAssetFile = {
    asset: ProjectArchiveAsset
    data: Uint8Array
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

async function createProjectArchive(projectId: number, body: ProjectArchiveExportBody) {
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
                metadata: include.imageMetadata ? image.metadata : {},
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

async function collectExportAssets(projectId: number, body: ProjectExportBody) {
    const source = await getProjectById(projectId)
    const template =
        body.outputTemplate ??
        source.settings.outputTemplate ??
        DEFAULT_PROJECT_SETTINGS.outputTemplate
    const sceneRows = await db
        .select({ id: scenes.id, name: scenes.name })
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(asc(scenes.displayOrder), asc(scenes.id))
    const sceneIds = sceneRows.map((scene) => scene.id)
    const used = new Map<string, number>()
    const assets: ExportAsset[] = []

    if (sceneIds.length === 0) return { project: source, assets }

    const imageRows = await db
        .select({
            id: images.id,
            sceneId: images.sceneId,
            filePath: images.filePath,
            createdAt: images.createdAt,
        })
        .from(images)
        .where(inArray(images.sceneId, sceneIds))
        .orderBy(asc(images.sceneId), desc(images.createdAt), desc(images.id))

    const imagesBySceneId = new Map<number, typeof imageRows>()
    for (const image of imageRows) {
        const rows = imagesBySceneId.get(image.sceneId) ?? []
        rows.push(image)
        imagesBySceneId.set(image.sceneId, rows)
    }

    for (const scene of sceneRows) {
        const sceneImages = (imagesBySceneId.get(scene.id) ?? []).slice(0, body.imageCount)
        for (const [index, image] of sceneImages.entries()) {
            const extension = fileExtension(image.filePath)
            const filename = uniqueFilename(
                renderOutputTemplate(template, {
                    character: source.name,
                    scene: scene.name,
                    number: index + 1,
                    extension,
                }),
                used,
            )

            assets.push({
                id: image.id,
                sceneId: scene.id,
                sceneName: scene.name,
                filePath: image.filePath,
                filename,
            })
        }
    }

    return { project: source, assets }
}

async function createExportZip(projectId: number, body: ProjectExportBody) {
    const { project: source, assets } = await collectExportAssets(projectId, body)
    const entries: Record<string, Uint8Array> = {}

    for (const asset of assets) {
        entries[asset.filename] = new Uint8Array(await dataStorage.readFile(asset.filePath))
    }

    const zip = zipSync(entries)
    const filename = `${sanitizeFilename(source.name)}-export.zip`

    log.info(
        { event: 'project.export.zip.created', projectId, exported: assets.length },
        'Project assets zipped',
    )
    return { zip, filename }
}

async function exportToServerPath(projectId: number, body: ProjectExportBody) {
    const serverPath = settingsService.get().export.serverPath.trim()
    if (!serverPath) throw new HTTPException(400, { message: 'Server export path is not set' })

    const { assets } = await collectExportAssets(projectId, body)
    await fs.mkdir(serverPath, { recursive: true })

    for (const asset of assets) {
        await fs.writeFile(
            join(serverPath, basename(asset.filename)),
            await dataStorage.readFile(asset.filePath),
        )
    }

    log.info(
        {
            event: 'project.export.server.completed',
            projectId,
            exported: assets.length,
            serverPath,
        },
        'Project assets exported',
    )
    return { exported: assets.length, assets }
}

export const projectExport = new Hono()
    .post(
        '/archive',
        zValidator('param', ProjectIdParams),
        zValidator('json', ProjectArchiveExportBody),
        async (c) => {
            const result = await createProjectArchive(
                c.req.valid('param').projectId,
                c.req.valid('json'),
            )

            return new Response(result.archive, {
                headers: {
                    'content-type': 'application/vnd.nai-factory.project+zip',
                    'content-disposition': contentDisposition(result.filename),
                },
            })
        },
    )
    .post(
        '/export/files',
        zValidator('param', ProjectIdParams),
        zValidator('json', ProjectExportBody),
        async (c) => {
            const { assets } = await collectExportAssets(
                c.req.valid('param').projectId,
                c.req.valid('json'),
            )
            return c.json({ exported: assets.length, assets })
        },
    )
    .post(
        '/export/zip',
        zValidator('param', ProjectIdParams),
        zValidator('json', ProjectExportBody),
        async (c) => {
            const result = await createExportZip(
                c.req.valid('param').projectId,
                c.req.valid('json'),
            )

            return new Response(result.zip, {
                headers: {
                    'content-type': 'application/zip',
                    'content-disposition': contentDisposition(result.filename),
                },
            })
        },
    )
    .post(
        '/export/server',
        zValidator('param', ProjectIdParams),
        zValidator('json', ProjectExportBody),
        async (c) => {
            return c.json(
                await exportToServerPath(c.req.valid('param').projectId, c.req.valid('json')),
            )
        },
    )
