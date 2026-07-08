import fs from 'node:fs/promises'
import { basename, extname, join, parse } from 'node:path'
import { DEFAULT_PROJECT_SETTINGS, type ProjectExportBody } from '@nai-factory/shared'
import { asc, eq, inArray } from 'drizzle-orm'
import { zipSync } from 'fflate'
import * as dataStorage from '@/data'
import { db, images, projects, scenes } from '@/db'
import logger from '@/logger'
import * as settingsService from '@/services/app/settings'
import { httpError, requireEntity, withNormalizedVariables } from '@/utils'

const log = logger.child({ module: 'project-export-service' })

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

function uniqueFilename(filename: string, used: Map<string, number>) {
    const count = used.get(filename) ?? 0
    used.set(filename, count + 1)
    if (count === 0) return filename

    const parsed = parse(filename)
    return `${parsed.name}-${count + 1}${parsed.ext}`
}

export async function collectExportAssets(projectId: number, body: ProjectExportBody) {
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
        })
        .from(images)
        .where(inArray(images.sceneId, sceneIds))
        .orderBy(asc(images.sceneId), asc(images.displayOrder), asc(images.id))

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

export async function createExportZip(projectId: number, body: ProjectExportBody) {
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

export async function exportToServerPath(projectId: number, body: ProjectExportBody) {
    const serverPath = settingsService.get().export.serverPath.trim()
    if (!serverPath) throw httpError(400, 'Server export path is not set')

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
