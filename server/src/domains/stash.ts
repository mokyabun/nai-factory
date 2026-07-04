import { zValidator } from '@hono/zod-validator'
import {
    IdParams,
    StashApplyBody,
    StashGetQuery,
    StashItem,
    type StashItem as StashItemType,
    StashParametersPayload,
    StashPatchBody,
    StashPostBody,
    StashPromptPayload,
    StashScenePayload,
} from '@nai-factory/shared'
import { asc, desc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { db, projects, scenes, sceneVariations, stashItems } from '@/db'
import logger from '@/logger'
import { removeByScene } from '@/services'
import { nextDisplayOrder } from '@/services/order'
import { requireEntity, withNormalizedVariables, withUpdatedAt } from '@/utils'

const log = logger.child({ module: 'stash-domain' })

function normalizeStashItem(row: typeof stashItems.$inferSelect): StashItemType {
    return StashItem.parse(row)
}

async function list(query: { type?: StashItemType['type'] }) {
    const rows = await db
        .select()
        .from(stashItems)
        .where(query.type ? eq(stashItems.type, query.type) : undefined)
        .orderBy(desc(stashItems.updatedAt), desc(stashItems.id))

    return rows.map(normalizeStashItem)
}

async function getById(id: number) {
    const [item] = await db.select().from(stashItems).where(eq(stashItems.id, id))
    return normalizeStashItem(requireEntity(item, 'Stash item not found'))
}

async function create(body: StashPostBody) {
    const [item] = await db
        .insert(stashItems)
        .values({
            type: body.type,
            name: body.name.trim(),
            payload: body.payload,
        })
        .returning()

    if (!item) throw new HTTPException(500, { message: 'Failed to create stash item' })
    log.debug({ stashId: item.id, type: item.type }, 'Stash item created')
    return normalizeStashItem(item)
}

function parsePayloadForType(type: StashItemType['type'], payload: unknown) {
    switch (type) {
        case 'prompt':
            return StashPromptPayload.parse(payload)
        case 'scene':
            return StashScenePayload.parse(payload)
        case 'parameters':
            return StashParametersPayload.parse(payload)
    }
}

async function update(id: number, body: StashPatchBody) {
    const current = await getById(id)
    const patch: Partial<typeof stashItems.$inferInsert> = {}
    if (body.name !== undefined) patch.name = body.name.trim()
    if (body.payload !== undefined) patch.payload = parsePayloadForType(current.type, body.payload)

    const [item] = await db
        .update(stashItems)
        .set(withUpdatedAt(patch))
        .where(eq(stashItems.id, id))
        .returning()

    log.debug({ stashId: id, fields: Object.keys(patch) }, 'Stash item updated')
    return normalizeStashItem(requireEntity(item, 'Stash item not found'))
}

async function remove(id: number) {
    await getById(id)
    await db.delete(stashItems).where(eq(stashItems.id, id))
    log.debug({ stashId: id }, 'Stash item deleted')
}

async function getProject(projectId: number) {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId))
    return withNormalizedVariables(requireEntity(project, 'Project not found'))
}

async function getLastSceneOrder(projectId: number) {
    const [scene] = await db
        .select({ displayOrder: scenes.displayOrder })
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(desc(scenes.displayOrder))
        .limit(1)

    return scene?.displayOrder ?? null
}

function variationOrder(index: number) {
    return index.toString().padStart(8, '0')
}

async function applyScenes(
    projectId: number,
    payload: StashScenePayload,
    mode: 'append' | 'replace',
) {
    await getProject(projectId)

    if (mode === 'replace') {
        const existingScenes = await db
            .select({ id: scenes.id })
            .from(scenes)
            .where(eq(scenes.projectId, projectId))

        await Promise.all(existingScenes.map((scene) => removeByScene(projectId, scene.id)))
        if (existingScenes.length > 0) {
            await db.delete(scenes).where(
                inArray(
                    scenes.id,
                    existingScenes.map((scene) => scene.id),
                ),
            )
        }
    }

    let lastOrder = mode === 'append' ? await getLastSceneOrder(projectId) : null
    for (const scenePayload of payload.scenes) {
        lastOrder = nextDisplayOrder(lastOrder)
        const [scene] = await db
            .insert(scenes)
            .values({
                projectId,
                displayOrder: lastOrder,
                name: scenePayload.name,
            })
            .returning()

        if (!scene) throw new HTTPException(500, { message: 'Failed to apply scene stash' })

        if (scenePayload.variations.length > 0) {
            await db.insert(sceneVariations).values(
                scenePayload.variations.map((variation, index) => ({
                    sceneId: scene.id,
                    displayOrder: variationOrder(index),
                    variables: variation.variables,
                })),
            )
        }
    }

    return payload.scenes.length
}

async function apply(id: number, body: StashApplyBody) {
    const item = await getById(id)

    if (item.type === 'prompt') {
        await getProject(body.projectId)
        await db
            .update(projects)
            .set(
                withUpdatedAt({
                    prompt: item.payload.prompt,
                    negativePrompt: item.payload.negativePrompt,
                    variables: item.payload.variables,
                    characterPrompts: item.payload.characterPrompts,
                }),
            )
            .where(eq(projects.id, body.projectId))

        log.debug({ stashId: id, projectId: body.projectId }, 'Prompt stash applied')
        return { applied: true }
    }

    if (item.type === 'parameters') {
        await getProject(body.projectId)
        await db
            .update(projects)
            .set(withUpdatedAt({ parameters: item.payload }))
            .where(eq(projects.id, body.projectId))

        log.debug({ stashId: id, projectId: body.projectId }, 'Parameters stash applied')
        return { applied: true }
    }

    const imported = await applyScenes(body.projectId, item.payload, body.mode ?? 'append')
    log.debug(
        { stashId: id, projectId: body.projectId, mode: body.mode ?? 'append', imported },
        'Scene stash applied',
    )
    return { applied: true, imported }
}

async function captureScenes(projectId: number, sceneIds?: number[]) {
    await getProject(projectId)
    const sceneRows = await db
        .select()
        .from(scenes)
        .where(
            sceneIds && sceneIds.length > 0
                ? inArray(scenes.id, sceneIds)
                : eq(scenes.projectId, projectId),
        )
        .orderBy(asc(scenes.displayOrder), asc(scenes.id))
    const projectScenes = sceneRows.filter((scene) => scene.projectId === projectId)
    const variations =
        projectScenes.length === 0
            ? []
            : await db
                  .select()
                  .from(sceneVariations)
                  .where(
                      inArray(
                          sceneVariations.sceneId,
                          projectScenes.map((scene) => scene.id),
                      ),
                  )
                  .orderBy(asc(sceneVariations.sceneId), asc(sceneVariations.displayOrder))

    return {
        scenes: projectScenes.map((scene) => ({
            name: scene.name,
            variations: variations
                .filter((variation) => variation.sceneId === scene.id)
                .map((variation) => ({ variables: withNormalizedVariables(variation).variables })),
        })),
    }
}

export const stash = new Hono()
    .get('/', zValidator('query', StashGetQuery), async (c) => {
        return c.json(await list(c.req.valid('query')))
    })
    .get('/:id', zValidator('param', IdParams), async (c) => {
        return c.json(await getById(c.req.valid('param').id))
    })
    .post('/', zValidator('json', StashPostBody), async (c) => {
        return c.json(await create(c.req.valid('json')), 201)
    })
    .patch('/:id', zValidator('param', IdParams), zValidator('json', StashPatchBody), async (c) => {
        return c.json(await update(c.req.valid('param').id, c.req.valid('json')))
    })
    .delete('/:id', zValidator('param', IdParams), async (c) => {
        await remove(c.req.valid('param').id)
        return c.body(null, 204)
    })
    .post(
        '/:id/apply',
        zValidator('param', IdParams),
        zValidator('json', StashApplyBody),
        async (c) => {
            return c.json(await apply(c.req.valid('param').id, c.req.valid('json')))
        },
    )
    .post(
        '/capture-scenes',
        zValidator(
            'json',
            StashApplyBody.pick({ projectId: true }).extend({
                sceneIds: IdParams.shape.id.array().optional(),
            }),
        ),
        async (c) => {
            const body = c.req.valid('json')
            return c.json(await captureScenes(body.projectId, body.sceneIds))
        },
    )
