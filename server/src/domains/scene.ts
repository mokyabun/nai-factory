import { zValidator } from '@hono/zod-validator'
import {
    IdParams,
    SceneGetQuery,
    SceneOrderPatchBody,
    ScenePatchBody,
    ScenePostBody,
    ScenePreviewGetQuery,
    type SceneVariationDraft,
} from '@nai-factory/shared'
import { asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { db, images, projects, scenes, sceneVariations, vibeTransfers } from '#/db'
import { compilePrompts, compileVariables, removeByScene } from '#/services'
import { nextDisplayOrder, planDisplayOrderUpdate } from '#/services/order'
import * as settingsService from '#/services/app/settings'
import { requireEntity, withUpdatedAt } from '#/shared'

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
            order by created_at desc, id desc
            limit 10
        ) i
    )`,
} as const

function variationOrder(index: number) {
    return index.toString().padStart(8, '0')
}

function parseLatestImages(value: string | null): LatestImage[] {
    if (!value) return []

    try {
        return JSON.parse(value) as LatestImage[]
    } catch {
        return []
    }
}

function parseSummary<T extends { latestImages: string | null }>(
    row: T,
    variations: (typeof sceneVariations.$inferSelect)[] = [],
) {
    return {
        ...row,
        variations,
        latestImages: parseLatestImages(row.latestImages),
    }
}

async function getVariations(sceneId: number) {
    return db
        .select()
        .from(sceneVariations)
        .where(eq(sceneVariations.sceneId, sceneId))
        .orderBy(asc(sceneVariations.displayOrder))
}

async function getVariationsBySceneIds(sceneIds: number[]) {
    if (sceneIds.length === 0) return new Map<number, (typeof sceneVariations.$inferSelect)[]>()

    const rows = await db
        .select()
        .from(sceneVariations)
        .where(inArray(sceneVariations.sceneId, sceneIds))
        .orderBy(asc(sceneVariations.sceneId), asc(sceneVariations.displayOrder))

    const bySceneId = new Map<number, (typeof sceneVariations.$inferSelect)[]>()
    for (const row of rows) {
        const items = bySceneId.get(row.sceneId) ?? []
        items.push(row)
        bySceneId.set(row.sceneId, items)
    }

    return bySceneId
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

async function list(projectId: number) {
    await getProject(projectId)

    const rows = await db
        .select(summaryColumns)
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(asc(scenes.displayOrder))

    const variations = await getVariationsBySceneIds(rows.map((row) => row.id))
    return rows.map((row) => parseSummary(row, variations.get(row.id)))
}

async function getSummary(id: number) {
    const [row] = await db.select(summaryColumns).from(scenes).where(eq(scenes.id, id))
    const scene = requireEntity(row, 'Scene not found')
    return parseSummary(scene, await getVariations(id))
}

async function getById(id: number) {
    const scene = await getScene(id)
    const [sceneImages, variations] = await Promise.all([
        db
            .select()
            .from(images)
            .where(eq(images.sceneId, id))
            .orderBy(desc(images.createdAt), desc(images.id)),
        getVariations(id),
    ])

    return { ...scene, variations, images: sceneImages }
}

async function getWorkspaceData(id: number) {
    const scene = await getScene(id)
    const project = await getProject(scene.projectId)
    const vibes = await db
        .select()
        .from(vibeTransfers)
        .where(eq(vibeTransfers.projectId, scene.projectId))
        .orderBy(asc(vibeTransfers.displayOrder))

    return {
        scene: { ...scene, variations: await getVariations(id) },
        project,
        vibeTransfers: vibes,
    }
}

async function getPreviewPrompts(id: number, variationId?: number) {
    const scene = await getScene(id)
    const project = await getProject(scene.projectId)
    const variables =
        variationId === undefined
            ? await getVariations(id).then((rows) => rows.map((row) => row.variables))
            : [
                  requireEntity(
                      await db
                          .select()
                          .from(sceneVariations)
                          .where(eq(sceneVariations.id, variationId))
                          .then((rows) => rows.find((row) => row.sceneId === id)),
                      'Variation not found',
                  ).variables,
              ]
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
        })
        .returning()

    if (!scene) throw new HTTPException(500, { message: 'Failed to create scene' })
    return { ...scene, variations: [] }
}

async function update(id: number, body: ScenePatchBody) {
    await getScene(id)

    const { variations, ...scenePatch } = body
    if (Object.keys(scenePatch).length > 0) {
        await db.update(scenes).set(withUpdatedAt(scenePatch)).where(eq(scenes.id, id))
    }

    if (variations) {
        await syncVariations(id, variations)
        await db.update(scenes).set(withUpdatedAt({})).where(eq(scenes.id, id))
    }

    return getById(id)
}

async function syncVariations(sceneId: number, drafts: SceneVariationDraft[]) {
    const existing = await getVariations(sceneId)
    const existingIds = new Set(existing.map((variation) => variation.id))
    const incomingIds = drafts
        .map((variation) => variation.id)
        .filter((id): id is number => id !== undefined && existingIds.has(id))

    const removedIds = existing
        .map((variation) => variation.id)
        .filter((id) => !incomingIds.includes(id))
    if (removedIds.length > 0) {
        await db.delete(sceneVariations).where(inArray(sceneVariations.id, removedIds))
    }

    for (const [index, variation] of drafts.entries()) {
        const values = {
            sceneId,
            displayOrder: variationOrder(index),
            variables: variation.variables,
        }

        if (variation.id && existingIds.has(variation.id)) {
            await db
                .update(sceneVariations)
                .set(withUpdatedAt(values))
                .where(eq(sceneVariations.id, variation.id))
        } else {
            await db.insert(sceneVariations).values(values)
        }
    }
}

async function reorder(id: number, prevId: number | null, nextId: number | null) {
    const scene = await getScene(id)
    const items = await db
        .select({ id: scenes.id, displayOrder: scenes.displayOrder })
        .from(scenes)
        .where(eq(scenes.projectId, scene.projectId))
        .orderBy(asc(scenes.displayOrder), asc(scenes.id))
    const plan = requireEntity(
        planDisplayOrderUpdate({
            entity: 'scene',
            items,
            id,
            prevId,
            nextId,
            logContext: { projectId: scene.projectId },
        }),
        'Scene not found',
    )

    const updated = db.transaction(() => {
        if (plan.type === 'rebalance') {
            for (const update of plan.updates) {
                db.update(scenes)
                    .set(withUpdatedAt({ displayOrder: update.displayOrder }))
                    .where(eq(scenes.id, update.id))
                    .run()
            }
        } else {
            db.update(scenes)
                .set(withUpdatedAt({ displayOrder: plan.displayOrder }))
                .where(eq(scenes.id, id))
                .run()
        }

        return db.select().from(scenes).where(eq(scenes.id, id)).get()
    })

    return requireEntity(updated, 'Scene not found')
}

async function remove(id: number) {
    const scene = await getScene(id)
    await removeByScene(scene.projectId, id)
    await db.delete(scenes).where(eq(scenes.id, id))
}

async function duplicate(id: number) {
    const source = await getScene(id)
    const sourceVariations = await getVariations(id)
    const [scene] = await db
        .insert(scenes)
        .values({
            projectId: source.projectId,
            displayOrder: nextDisplayOrder(await getLastOrder(source.projectId)),
            name: `${source.name} Copy`,
        })
        .returning()

    if (!scene) throw new HTTPException(500, { message: 'Failed to duplicate scene' })
    if (sourceVariations.length > 0) {
        await db.insert(sceneVariations).values(
            sourceVariations.map((variation) => ({
                sceneId: scene.id,
                displayOrder: variation.displayOrder,
                variables: variation.variables,
            })),
        )
    }

    return getById(scene.id)
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
