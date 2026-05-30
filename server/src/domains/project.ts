import fs from 'node:fs/promises'
import { basename, extname, join, parse } from 'node:path'
import { zValidator } from '@hono/zod-validator'
import {
    DEFAULT_PROJECT_SETTINGS,
    ProjectExportBody,
    ProjectGetQuery,
    ProjectIdParams,
    ProjectPatchBody,
    ProjectPostBody,
} from '@nai-factory/shared'
import { asc, desc, eq, inArray, isNull } from 'drizzle-orm'
import { zipSync } from 'fflate'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { db, images, projects, scenes, sceneVariations } from '../db'
import logger from '../logger'
import { removeByProject, removeCharacterReferencesByProject } from '../services'
import * as settingsService from '../services/app/settings'
import { requireEntity, withUpdatedAt } from '../shared'

const log = logger.child({ module: 'project-domain' })

async function getAllByGroupId(groupId?: number | 'null' | 'ungrouped') {
    return db
        .select()
        .from(projects)
        .where(
            groupId === undefined
                ? undefined
                : groupId === 'null' || groupId === 'ungrouped'
                  ? isNull(projects.groupId)
                  : eq(projects.groupId, groupId),
        )
        .orderBy(asc(projects.id))
}

async function getById(projectId: number) {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId))
    return requireEntity(project, 'Project not found')
}

async function create(body: ProjectPostBody) {
    const [project] = await db.insert(projects).values(body).returning()
    if (!project) throw new HTTPException(500, { message: 'Failed to create project' })
    log.info({ projectId: project.id, groupId: project.groupId }, 'Project created')
    return project
}

async function update(projectId: number, body: ProjectPatchBody) {
    const current = body.settings ? await getById(projectId) : null
    const patch: ProjectPatchBody = current
        ? { ...body, settings: { ...current.settings, ...body.settings } }
        : body

    const [project] = await db
        .update(projects)
        .set(withUpdatedAt(patch))
        .where(eq(projects.id, projectId))
        .returning()

    const result = requireEntity(project, 'Project not found')
    log.info({ projectId, fields: Object.keys(patch) }, 'Project updated')
    return result
}

async function remove(projectId: number) {
    await getById(projectId)
    await Promise.all([removeByProject(projectId), removeCharacterReferencesByProject(projectId)])
    await db.delete(projects).where(eq(projects.id, projectId))
    log.warn({ projectId }, 'Project deleted')
}

async function duplicate(projectId: number) {
    const source = await getById(projectId)
    const sourceScenes = await db
        .select()
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(asc(scenes.displayOrder))
    const sourceVariations =
        sourceScenes.length === 0
            ? []
            : await db
                  .select()
                  .from(sceneVariations)
                  .where(
                      inArray(
                          sceneVariations.sceneId,
                          sourceScenes.map((scene) => scene.id),
                      ),
                  )
                  .orderBy(asc(sceneVariations.sceneId), asc(sceneVariations.displayOrder))

    const [project] = await db
        .insert(projects)
        .values({
            groupId: source.groupId,
            name: `${source.name} Copy`,
            prompt: source.prompt,
            negativePrompt: source.negativePrompt,
            variables: source.variables,
            parameters: source.parameters,
            characterPrompts: source.characterPrompts,
            settings: source.settings,
        })
        .returning()
    if (!project) throw new HTTPException(500, { message: 'Failed to duplicate project' })

    for (const sourceScene of sourceScenes) {
        const [scene] = await db
            .insert(scenes)
            .values({
                projectId: project.id,
                displayOrder: sourceScene.displayOrder,
                name: sourceScene.name,
            })
            .returning()
        if (!scene) throw new HTTPException(500, { message: 'Failed to duplicate scene' })

        const variations = sourceVariations.filter(
            (variation) => variation.sceneId === sourceScene.id,
        )
        if (variations.length > 0) {
            await db.insert(sceneVariations).values(
                variations.map((variation) => ({
                    sceneId: scene.id,
                    displayOrder: variation.displayOrder,
                    variables: variation.variables,
                })),
            )
        }
    }

    log.info(
        {
            sourceProjectId: projectId,
            projectId: project.id,
            sceneCount: sourceScenes.length,
            variationCount: sourceVariations.length,
        },
        'Project duplicated',
    )

    return project
}

type ExportAsset = {
    id: number
    sceneId: number
    sceneName: string
    filePath: string
    filename: string
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

async function collectExportAssets(projectId: number, body: ProjectExportBody) {
    const source = await getById(projectId)
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
        entries[asset.filename] = new Uint8Array(await fs.readFile(asset.filePath))
    }

    const zip = zipSync(entries)
    const filename = `${sanitizeFilename(source.name)}-export.zip`

    log.info({ projectId, exported: assets.length }, 'Project assets zipped')
    return { zip, filename, assets }
}

async function exportToServerPath(projectId: number, body: ProjectExportBody) {
    const serverPath = settingsService.get().export.serverPath.trim()
    if (!serverPath) throw new HTTPException(400, { message: 'Server export path is not set' })

    const { assets } = await collectExportAssets(projectId, body)
    await fs.mkdir(serverPath, { recursive: true })

    for (const asset of assets) {
        await fs.copyFile(asset.filePath, join(serverPath, basename(asset.filename)))
    }

    log.info({ projectId, exported: assets.length, serverPath }, 'Project assets exported')
    return { exported: assets.length, assets }
}

export const project = new Hono()
    .get('/', zValidator('query', ProjectGetQuery), async (c) => {
        const query = c.req.valid('query')
        return c.json(await getAllByGroupId(query.groupId))
    })
    .get('/:projectId', zValidator('param', ProjectIdParams), async (c) => {
        return c.json(await getById(c.req.valid('param').projectId))
    })
    .post('/', zValidator('json', ProjectPostBody), async (c) => {
        const body = c.req.valid('json')
        return c.json(await create(body), 201)
    })
    .patch(
        '/:projectId',
        zValidator('param', ProjectIdParams),
        zValidator('json', ProjectPatchBody),
        async (c) => {
            return c.json(await update(c.req.valid('param').projectId, c.req.valid('json')))
        },
    )
    .delete('/:projectId', zValidator('param', ProjectIdParams), async (c) => {
        await remove(c.req.valid('param').projectId)
        return c.body(null, 204)
    })
    .post('/:projectId/duplicate', zValidator('param', ProjectIdParams), async (c) => {
        return c.json(await duplicate(c.req.valid('param').projectId), 201)
    })
    .post(
        '/:projectId/export/files',
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
        '/:projectId/export/zip',
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
        '/:projectId/export/server',
        zValidator('param', ProjectIdParams),
        zValidator('json', ProjectExportBody),
        async (c) => {
            return c.json(
                await exportToServerPath(c.req.valid('param').projectId, c.req.valid('json')),
            )
        },
    )
