import { zValidator } from '@hono/zod-validator'
import {
    IdParams,
    SceneGetQuery,
    SceneOrderPatchBody,
    ScenePatchBody,
    ScenePostBody,
    ScenePreviewGetQuery,
} from '@nai-factory/types'
import { asc, desc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { db, images, projects, scenes, vibeTransfers } from '#/db'
import { compilePrompts, compileVariables, removeByScene } from '#/services'
import * as settingsService from '#/services/app/settings'
import { displayOrderBetween, nextDisplayOrder, requireEntity, withUpdatedAt } from '#/shared'

type LatestImage = {
    id: number
    filePath: string
    thumbnailPath: string | null
}

const summaryColumns = {
    id: scenes.id,
    projectId: scenes.projectId,
    displayOrder: scenes.displayOrder,
    name: scenes.name,
    variations: scenes.variations,
    createdAt: scenes.createdAt,
    updatedAt: scenes.updatedAt,
    imageCount: sql<number>`(select count(*) from images where images.scene_id = scenes.id)`,
    queueCount: sql<number>`(select count(*) from queue_items where queue_items.scene_id = scenes.id)`,
    latestImages: sql<string | null>`(
        select json_group_array(json_object(
            'id', i.id,
            'filePath', i.file_path,
            'thumbnailPath', i.thumbnail_path
        ))
        from (
            select id, file_path, thumbnail_path
            from images
            where scene_id = scenes.id
            order by display_order desc
            limit 10
        ) i
    )`,
} as const

function parseLatestImages(value: string | null): LatestImage[] {
    if (!value) return []

    try {
        return JSON.parse(value) as LatestImage[]
    } catch {
        return []
    }
}

function parseSummary<T extends { latestImages: string | null }>(row: T) {
    return {
        ...row,
        latestImages: parseLatestImages(row.latestImages),
    }
}

async function getProject(projectId: number) {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId))
    return requireEntity(project, 'Project not found')
}

async function getScene(id: number) {
    const [scene] = await db.select().from(scenes).where(eq(scenes.id, id))
    return requireEntity(scene, 'Scene not found')
}

async function getLastOrder(projectId: number) {
    const [scene] = await db
        .select({ displayOrder: scenes.displayOrder })
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(desc(scenes.displayOrder))
        .limit(1)

    return scene?.displayOrder ?? null
}

async function getSiblingOrder(id: number, projectId: number, label: string) {
    const [scene] = await db
        .select({ projectId: scenes.projectId, displayOrder: scenes.displayOrder })
        .from(scenes)
        .where(eq(scenes.id, id))

    const sibling = requireEntity(scene, `${label} scene not found`)
    if (sibling.projectId !== projectId) {
        throw new HTTPException(400, { message: `${label} scene belongs to another project` })
    }

    return sibling.displayOrder
}

async function list(projectId: number) {
    await getProject(projectId)

    const rows = await db
        .select(summaryColumns)
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(asc(scenes.displayOrder))

    return rows.map(parseSummary)
}

async function getSummary(id: number) {
    const [row] = await db.select(summaryColumns).from(scenes).where(eq(scenes.id, id))
    return parseSummary(requireEntity(row, 'Scene not found'))
}

async function getById(id: number) {
    const scene = await getScene(id)
    const sceneImages = await db
        .select()
        .from(images)
        .where(eq(images.sceneId, id))
        .orderBy(desc(images.displayOrder))

    return { ...scene, images: sceneImages }
}

async function getWorkspaceData(id: number) {
    const scene = await getScene(id)
    const project = await getProject(scene.projectId)
    const vibes = await db
        .select()
        .from(vibeTransfers)
        .where(eq(vibeTransfers.projectId, scene.projectId))
        .orderBy(asc(vibeTransfers.displayOrder))

    return { scene, project, vibeTransfers: vibes }
}

async function getPreviewPrompts(id: number, variationId?: number) {
    const scene = await getScene(id)
    const project = await getProject(scene.projectId)
    const variables =
        variationId === undefined
            ? scene.variations
            : [requireEntity(scene.variations[variationId], 'Variation not found')]
    const settings = settingsService.get()

    return compilePrompts(
        {
            prompt: project.prompt,
            negativePrompt: project.negativePrompt,
            characterPrompts: project.characterPrompts,
        },
        compileVariables(settings.globalVariables, project.variables, variables),
    )
}

async function create(body: ScenePostBody) {
    await getProject(body.projectId)
    const [scene] = await db
        .insert(scenes)
        .values({
            projectId: body.projectId,
            name: body.name,
            displayOrder: nextDisplayOrder(await getLastOrder(body.projectId)),
            variations: [],
        })
        .returning()

    if (!scene) throw new HTTPException(500, { message: 'Failed to create scene' })
    return scene
}

async function update(id: number, body: ScenePatchBody) {
    const [scene] = await db
        .update(scenes)
        .set(withUpdatedAt(body))
        .where(eq(scenes.id, id))
        .returning()

    return requireEntity(scene, 'Scene not found')
}

async function reorder(id: number, prevId: number | null, nextId: number | null) {
    const scene = await getScene(id)
    const prevOrder = prevId ? await getSiblingOrder(prevId, scene.projectId, 'Previous') : null
    const nextOrder = nextId ? await getSiblingOrder(nextId, scene.projectId, 'Next') : null

    const [updated] = await db
        .update(scenes)
        .set(withUpdatedAt({ displayOrder: displayOrderBetween(prevOrder, nextOrder) }))
        .where(eq(scenes.id, id))
        .returning()

    return requireEntity(updated, 'Scene not found')
}

async function remove(id: number) {
    const scene = await getScene(id)
    await removeByScene(scene.projectId, id)
    await db.delete(scenes).where(eq(scenes.id, id))
}

async function duplicate(id: number) {
    const source = await getScene(id)
    const [scene] = await db
        .insert(scenes)
        .values({
            projectId: source.projectId,
            displayOrder: nextDisplayOrder(await getLastOrder(source.projectId)),
            name: `${source.name} Copy`,
            variations: source.variations,
        })
        .returning()

    if (!scene) throw new HTTPException(500, { message: 'Failed to duplicate scene' })
    return scene
}

export const scene = new Hono()
    .get('/', zValidator('query', SceneGetQuery), async (c) => {
        const query = c.req.valid('query')
        return c.json(await list(query.projectId))
    })
    .get('/:id', zValidator('param', IdParams), async (c) => {
        return c.json(await getById(c.req.valid('param').id))
    })
    .get('/:id/summary', zValidator('param', IdParams), async (c) => {
        return c.json(await getSummary(c.req.valid('param').id))
    })
    .get('/:id/workspace', zValidator('param', IdParams), async (c) => {
        return c.json(await getWorkspaceData(c.req.valid('param').id))
    })
    .get(
        '/:id/preview-prompt',
        zValidator('param', IdParams),
        zValidator('query', ScenePreviewGetQuery),
        async (c) => {
            const { id } = c.req.valid('param')
            const { variationId } = c.req.valid('query')
            return c.json(await getPreviewPrompts(id, variationId))
        },
    )
    .post('/', zValidator('json', ScenePostBody), async (c) => {
        return c.json(await create(c.req.valid('json')), 201)
    })
    .patch('/:id', zValidator('param', IdParams), zValidator('json', ScenePatchBody), async (c) => {
        return c.json(await update(c.req.valid('param').id, c.req.valid('json')))
    })
    .patch(
        '/:id/order',
        zValidator('param', IdParams),
        zValidator('json', SceneOrderPatchBody),
        async (c) => {
            const { id } = c.req.valid('param')
            const { prevId, nextId } = c.req.valid('json')
            return c.json(await reorder(id, prevId, nextId))
        },
    )
    .delete('/:id', zValidator('param', IdParams), async (c) => {
        await remove(c.req.valid('param').id)
        return c.body(null, 204)
    })
    .post('/:id/duplicate', zValidator('param', IdParams), async (c) => {
        return c.json(await duplicate(c.req.valid('param').id), 201)
    })
