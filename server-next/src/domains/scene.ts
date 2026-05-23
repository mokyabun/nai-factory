import { zValidator } from '@hono/zod-validator'
import type { PromptVariable } from '@nai-factory/types'
import {
    CreateSceneBody,
    ReorderSceneBody,
    SceneIdParams,
    SceneListQuery,
    ScenePreviewQuery,
    type UpdateSceneBody,
    UpdateSceneBody as UpdateSceneBodySchema,
} from '@nai-factory/types'
import { asc, desc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { db, images, projects, scenes, vibeTransfers } from '#/db'
import { compilePrompts, compileVariables, get as getSettings, removeByScene } from '#/services'
import { displayOrderBetween, nextDisplayOrder, requireEntity, withUpdatedAt } from '#/shared'

type LatestImage = {
    id: number
    filePath: string
    thumbnailPath: string | null
}

const sceneSummaryColumns = {
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

function parseRow<T extends { latestImages: string | null }>(row: T) {
    return {
        ...row,
        latestImages: JSON.parse(row.latestImages ?? '[]') as LatestImage[],
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

async function getLastSceneOrder(projectId: number) {
    const [last] = await db
        .select({ displayOrder: scenes.displayOrder })
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(desc(scenes.displayOrder))
        .limit(1)

    return last?.displayOrder ?? null
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
        .select(sceneSummaryColumns)
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(asc(scenes.displayOrder), asc(scenes.id))
    return rows.map(parseRow)
}

async function getSummary(id: number) {
    const [scene] = await db.select(sceneSummaryColumns).from(scenes).where(eq(scenes.id, id))
    return parseRow(requireEntity(scene, 'Scene not found'))
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

async function getWorkspaceData(sceneId: number) {
    const { projectId } = await getScene(sceneId)
    const proj = await getProject(projectId)
    const vibes = await db
        .select({
            id: vibeTransfers.id,
            projectId: vibeTransfers.projectId,
            displayOrder: vibeTransfers.displayOrder,
            sourceImagePath: vibeTransfers.sourceImagePath,
            referenceStrength: vibeTransfers.referenceStrength,
            informationExtracted: vibeTransfers.informationExtracted,
            createdAt: vibeTransfers.createdAt,
            updatedAt: vibeTransfers.updatedAt,
        })
        .from(vibeTransfers)
        .where(eq(vibeTransfers.projectId, projectId))
        .orderBy(asc(vibeTransfers.displayOrder), asc(vibeTransfers.id))

    return { ...proj, vibeTransfers: vibes }
}

async function getPreviewPrompts(id: number, variationId?: number) {
    const scene = await getScene(id)
    const project = await getProject(scene.projectId)
    let variationList = scene.variations

    if (variationId !== undefined) {
        const variation = variationList[variationId]
        if (!variation) throw new HTTPException(404, { message: 'Variation not found' })
        variationList = [variation]
    }

    const settings = getSettings()
    return compilePrompts(
        {
            prompt: project.prompt,
            negativePrompt: project.negativePrompt,
            characterPrompts: project.characterPrompts,
        },
        compileVariables(settings.globalVariables, project.variables, variationList),
    )
}

async function create(projectId: number, name: string) {
    await getProject(projectId)
    const [created] = await db
        .insert(scenes)
        .values({
            projectId,
            name,
            displayOrder: nextDisplayOrder(await getLastSceneOrder(projectId)),
        })
        .returning()
    return created
}

async function update(id: number, body: UpdateSceneBody) {
    await getScene(id)
    const [updated] = await db
        .update(scenes)
        .set(withUpdatedAt(body as { name?: string; variations?: PromptVariable[] }))
        .where(eq(scenes.id, id))
        .returning()
    return updated
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
    return updated
}

async function remove(id: number) {
    const scene = await getScene(id)
    await db.delete(scenes).where(eq(scenes.id, id))
    await removeByScene(scene.projectId, scene.id)
    return { success: true }
}

async function duplicate(id: number) {
    const scene = await getScene(id)
    const [created] = await db
        .insert(scenes)
        .values({
            projectId: scene.projectId,
            name: `${scene.name} (copy)`,
            displayOrder: nextDisplayOrder(await getLastSceneOrder(scene.projectId)),
            variations: scene.variations,
        })
        .returning()
    return created
}

export const scene = new Hono()
    .get('/', zValidator('query', SceneListQuery), async (c) =>
        c.json(await list(c.req.valid('query').projectId)),
    )
    .get('/:id', zValidator('param', SceneIdParams), async (c) =>
        c.json(await getById(c.req.valid('param').id)),
    )
    .get('/:id/summary', zValidator('param', SceneIdParams), async (c) =>
        c.json(await getSummary(c.req.valid('param').id)),
    )
    .get('/:id/workspace', zValidator('param', SceneIdParams), async (c) =>
        c.json(await getWorkspaceData(c.req.valid('param').id)),
    )
    .get(
        '/:id/preview-prompt',
        zValidator('param', SceneIdParams),
        zValidator('query', ScenePreviewQuery),
        async (c) => {
            const { id } = c.req.valid('param')
            const { variationId } = c.req.valid('query')
            return c.json(await getPreviewPrompts(id, variationId))
        },
    )
    .post('/', zValidator('json', CreateSceneBody), async (c) => {
        const { projectId, name } = c.req.valid('json')
        return c.json(await create(projectId, name))
    })
    .patch(
        '/:id',
        zValidator('param', SceneIdParams),
        zValidator('json', UpdateSceneBodySchema),
        async (c) => c.json(await update(c.req.valid('param').id, c.req.valid('json'))),
    )
    .patch(
        '/:id/order',
        zValidator('param', SceneIdParams),
        zValidator('json', ReorderSceneBody),
        async (c) => {
            const { id } = c.req.valid('param')
            const { prevId, nextId } = c.req.valid('json')
            return c.json(await reorder(id, prevId, nextId))
        },
    )
    .delete('/:id', zValidator('param', SceneIdParams), async (c) =>
        c.json(await remove(c.req.valid('param').id)),
    )
    .post('/:id/duplicate', zValidator('param', SceneIdParams), async (c) =>
        c.json(await duplicate(c.req.valid('param').id)),
    )
