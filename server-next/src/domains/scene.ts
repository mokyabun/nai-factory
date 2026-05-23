import { zValidator } from '@hono/zod-validator'
<<<<<<< HEAD
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
import { db, images, projects, scenes, vibeTransfers } from '#/db'
import { compilePrompts, compileVariables, get as getSettings, removeByScene } from '#/services'
import {
    displayOrderBetween,
    httpError,
    nextDisplayOrder,
    requireEntity,
    withUpdatedAt,
} from '#/shared'
=======
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
>>>>>>> refs/remotes/origin/main

type LatestImage = {
    id: number
    filePath: string
    thumbnailPath: string | null
}

<<<<<<< HEAD
const summaryColumns = {
=======
const sceneSummaryColumns = {
>>>>>>> refs/remotes/origin/main
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

<<<<<<< HEAD
function parseSummary<T extends { latestImages: string | null }>(row: T) {
    return { ...row, latestImages: JSON.parse(row.latestImages ?? '[]') as LatestImage[] }
=======
function parseRow<T extends { latestImages: string | null }>(row: T) {
    return {
        ...row,
        latestImages: JSON.parse(row.latestImages ?? '[]') as LatestImage[],
    }
>>>>>>> refs/remotes/origin/main
}

async function getProject(projectId: number) {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId))
    return requireEntity(project, 'Project not found')
}

async function getScene(id: number) {
    const [scene] = await db.select().from(scenes).where(eq(scenes.id, id))
    return requireEntity(scene, 'Scene not found')
}

<<<<<<< HEAD
async function getLastOrder(projectId: number) {
=======
async function getLastSceneOrder(projectId: number) {
>>>>>>> refs/remotes/origin/main
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
<<<<<<< HEAD
    if (sibling.projectId !== projectId)
        throw httpError(400, `${label} scene belongs to another project`)
=======
    if (sibling.projectId !== projectId) {
        throw new HTTPException(400, { message: `${label} scene belongs to another project` })
    }
>>>>>>> refs/remotes/origin/main

    return sibling.displayOrder
}

async function list(projectId: number) {
    await getProject(projectId)
    const rows = await db
<<<<<<< HEAD
        .select(summaryColumns)
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(asc(scenes.displayOrder), asc(scenes.id))

    return rows.map(parseSummary)
}

async function getSummary(id: number) {
    const [scene] = await db.select(summaryColumns).from(scenes).where(eq(scenes.id, id))
    return parseSummary(requireEntity(scene, 'Scene not found'))
=======
        .select(sceneSummaryColumns)
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(asc(scenes.displayOrder), asc(scenes.id))
    return rows.map(parseRow)
}

async function getSummary(id: number) {
    const [scene] = await db.select(sceneSummaryColumns).from(scenes).where(eq(scenes.id, id))
    return parseRow(requireEntity(scene, 'Scene not found'))
>>>>>>> refs/remotes/origin/main
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

<<<<<<< HEAD
async function getWorkspaceData(id: number) {
    const { projectId } = await getScene(id)
    const project = await getProject(projectId)
    const projectVibes = await db
=======
async function getWorkspaceData(sceneId: number) {
    const { projectId } = await getScene(sceneId)
    const proj = await getProject(projectId)
    const vibes = await db
>>>>>>> refs/remotes/origin/main
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

<<<<<<< HEAD
    return { ...project, vibeTransfers: projectVibes }
=======
    return { ...proj, vibeTransfers: vibes }
>>>>>>> refs/remotes/origin/main
}

async function getPreviewPrompts(id: number, variationId?: number) {
    const scene = await getScene(id)
    const project = await getProject(scene.projectId)
<<<<<<< HEAD
    const globalSettings = getSettings()

    let variations = scene.variations
    if (variationId !== undefined) {
        const variation = variations[variationId]
        if (!variation) throw httpError(404, 'Variation not found')
        variations = [variation]
    }

=======
    let variationList = scene.variations

    if (variationId !== undefined) {
        const variation = variationList[variationId]
        if (!variation) throw new HTTPException(404, { message: 'Variation not found' })
        variationList = [variation]
    }

    const settings = getSettings()
>>>>>>> refs/remotes/origin/main
    return compilePrompts(
        {
            prompt: project.prompt,
            negativePrompt: project.negativePrompt,
            characterPrompts: project.characterPrompts,
        },
<<<<<<< HEAD
        compileVariables(globalSettings.globalVariables, project.variables, variations),
=======
        compileVariables(settings.globalVariables, project.variables, variationList),
>>>>>>> refs/remotes/origin/main
    )
}

async function create(projectId: number, name: string) {
    await getProject(projectId)
    const [created] = await db
        .insert(scenes)
<<<<<<< HEAD
        .values({ projectId, name, displayOrder: nextDisplayOrder(await getLastOrder(projectId)) })
        .returning()

    return created
}

async function update(id: number, body: ScenePatchBody) {
    await getScene(id)
    const [updated] = await db
        .update(scenes)
        .set(withUpdatedAt(body))
        .where(eq(scenes.id, id))
        .returning()

=======
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
>>>>>>> refs/remotes/origin/main
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
<<<<<<< HEAD

=======
>>>>>>> refs/remotes/origin/main
    return updated
}

async function remove(id: number) {
    const scene = await getScene(id)
    await db.delete(scenes).where(eq(scenes.id, id))
    await removeByScene(scene.projectId, scene.id)
<<<<<<< HEAD

=======
>>>>>>> refs/remotes/origin/main
    return { success: true }
}

async function duplicate(id: number) {
    const scene = await getScene(id)
    const [created] = await db
        .insert(scenes)
        .values({
            projectId: scene.projectId,
            name: `${scene.name} (copy)`,
<<<<<<< HEAD
            displayOrder: nextDisplayOrder(await getLastOrder(scene.projectId)),
            variations: scene.variations,
        })
        .returning()

=======
            displayOrder: nextDisplayOrder(await getLastSceneOrder(scene.projectId)),
            variations: scene.variations,
        })
        .returning()
>>>>>>> refs/remotes/origin/main
    return created
}

export const scene = new Hono()
<<<<<<< HEAD
    .get('/', zValidator('query', SceneGetQuery), async (c) => {
        return c.json(await list(c.req.valid('query').projectId))
    })
    .get('/:id', zValidator('param', IdParams), async (c) =>
        c.json(await getById(c.req.valid('param').id)),
    )
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
        async (c) =>
            c.json(
                await getPreviewPrompts(c.req.valid('param').id, c.req.valid('query').variationId),
            ),
    )
    .post('/', zValidator('json', ScenePostBody), async (c) => {
        const { projectId, name } = c.req.valid('json')
        return c.json(await create(projectId, name), 201)
    })
    .patch('/:id', zValidator('param', IdParams), zValidator('json', ScenePatchBody), async (c) => {
        return c.json(await update(c.req.valid('param').id, c.req.valid('json')))
    })
    .patch(
        '/:id/order',
        zValidator('param', IdParams),
        zValidator('json', SceneOrderPatchBody),
        async (c) => {
            const { prevId, nextId } = c.req.valid('json')
            return c.json(await reorder(c.req.valid('param').id, prevId, nextId))
        },
    )
    .delete('/:id', zValidator('param', IdParams), async (c) =>
        c.json(await remove(c.req.valid('param').id)),
    )
    .post('/:id/duplicate', zValidator('param', IdParams), async (c) => {
        return c.json(await duplicate(c.req.valid('param').id), 201)
    })
=======
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
>>>>>>> refs/remotes/origin/main
