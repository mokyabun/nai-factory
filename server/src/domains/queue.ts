import { zValidator } from '@hono/zod-validator'
import {
    IdParams,
    QueueClearQuery,
    QueueEnqueueAllBody,
    QueueEnqueueBody,
    QueueEnqueueBulkBody,
    QueueGetQuery,
} from '@nai-factory/shared'
import { and, asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { db, playgroundQueueItems, projects, queueItems, scenes } from '../db'
import logger from '../logger'
import { queueManager } from '../services'

const log = logger.child({ module: 'queue-domain' })

async function get(projectId?: number) {
    const sceneRows = await db
        .select({
            id: queueItems.id,
            projectId: queueItems.projectId,
            sceneId: queueItems.sceneId,
            sceneVariationId: queueItems.sceneVariationId,
            sceneName: scenes.name,
            sortIndex: queueItems.sortIndex,
        })
        .from(queueItems)
        .innerJoin(scenes, eq(queueItems.sceneId, scenes.id))
        .where(projectId ? eq(queueItems.projectId, projectId) : undefined)
        .orderBy(asc(queueItems.sortIndex))

    if (projectId) {
        return sceneRows.map((row) => ({ ...row, type: 'scene' as const }))
    }

    const playgroundRows = await db
        .select({
            id: playgroundQueueItems.id,
            prompt: playgroundQueueItems.prompt,
            sortIndex: playgroundQueueItems.sortIndex,
        })
        .from(playgroundQueueItems)
        .orderBy(asc(playgroundQueueItems.sortIndex))

    return [
        ...sceneRows.map((row) => ({ ...row, type: 'scene' as const })),
        ...playgroundRows.map((row) => ({ ...row, type: 'playground' as const })),
    ].sort((a, b) => a.sortIndex - b.sortIndex)
}

async function enqueue(
    sceneId: number,
    position: QueueEnqueueBody['position'] = 'back',
    sceneVariationId?: number,
) {
    try {
        const items = await queueManager.add(sceneId, position, sceneVariationId)
        log.info({ sceneId, sceneVariationId, position, queued: items.length }, 'Scene queued')
        return items
    } catch (error) {
        throw new HTTPException(404, {
            message: error instanceof Error ? error.message : 'Scene not found',
        })
    }
}

async function enqueueAll(projectId: number, position: QueueEnqueueAllBody['position'] = 'back') {
    const [project] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, projectId))
    if (!project) throw new HTTPException(404, { message: 'Project not found' })

    const rows = await db
        .select({ id: scenes.id })
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(asc(scenes.displayOrder))

    const items = []
    const orderedRows = position === 'front' ? [...rows].reverse() : rows

    for (const scene of orderedRows) {
        items.push(...(await enqueue(scene.id, position)))
    }

    log.info(
        { projectId, position, sceneCount: rows.length, queued: items.length },
        'Project queued',
    )
    return items
}

async function enqueueBulk(
    sceneIds: number[],
    position: QueueEnqueueBulkBody['position'] = 'back',
) {
    const items = []
    const orderedSceneIds = position === 'front' ? [...sceneIds].reverse() : sceneIds
    for (const sceneId of orderedSceneIds) {
        items.push(...(await enqueue(sceneId, position)))
    }
    log.info({ position, sceneCount: sceneIds.length, queued: items.length }, 'Scenes queued')
    return items
}

async function cancel(id: number) {
    const [item] = await db
        .select({ id: queueItems.id })
        .from(queueItems)
        .where(eq(queueItems.id, id))
    if (!item) throw new HTTPException(404, { message: 'Queue item not found' })

    await queueManager.cancel([id])
    log.warn({ jobId: id }, 'Queue item cancelled')
}

async function clear(sceneId?: number, sceneVariationId?: number) {
    if (!sceneId && !sceneVariationId) {
        const [sceneRows, playgroundRows] = await Promise.all([
            db.select({ id: queueItems.id }).from(queueItems),
            db.select({ id: playgroundQueueItems.id }).from(playgroundQueueItems),
        ])

        await Promise.all([
            queueManager.cancel(sceneRows.map((row) => row.id)),
            db.delete(playgroundQueueItems),
        ])

        log.warn(
            { sceneQueueCount: sceneRows.length, playgroundQueueCount: playgroundRows.length },
            'Queue cleared',
        )
        return { cancelled: sceneRows.length + playgroundRows.length }
    }

    const rows = await db
        .select({ id: queueItems.id })
        .from(queueItems)
        .where(
            and(
                sceneId ? eq(queueItems.sceneId, sceneId) : undefined,
                sceneVariationId ? eq(queueItems.sceneVariationId, sceneVariationId) : undefined,
            ),
        )

    await queueManager.cancel(rows.map((row) => row.id))
    log.warn(
        { sceneId, sceneVariationId, cancelled: rows.length },
        'Queue filtered clear completed',
    )
    return { cancelled: rows.length }
}

export const queue = new Hono()
    .get('/', zValidator('query', QueueGetQuery), async (c) => {
        const query = c.req.valid('query')
        return c.json(await get(query.projectId))
    })
    .get('/status', async (c) => c.json(await queueManager.status()))
    .post('/enqueue', zValidator('json', QueueEnqueueBody), async (c) => {
        const body = c.req.valid('json')
        const items = await enqueue(body.sceneId, body.position, body.sceneVariationId)
        return c.json({ queued: items.length, items }, 201)
    })
    .post('/enqueue-all', zValidator('json', QueueEnqueueAllBody), async (c) => {
        const body = c.req.valid('json')
        const items = await enqueueAll(body.projectId, body.position)
        return c.json({ queued: items.length, items }, 201)
    })
    .post('/enqueue-bulk', zValidator('json', QueueEnqueueBulkBody), async (c) => {
        const body = c.req.valid('json')
        const items = await enqueueBulk(body.sceneIds, body.position)
        return c.json({ queued: items.length, items }, 201)
    })
    .post('/start', async (c) => {
        queueManager.start()
        return c.json(await queueManager.status())
    })
    .post('/stop', async (c) => {
        queueManager.stop()
        return c.json(await queueManager.status())
    })
    .delete('/', zValidator('query', QueueClearQuery), async (c) => {
        const query = c.req.valid('query')
        const result = await clear(query.sceneId, query.sceneVariationId)
        return c.json(result)
    })
    .delete('/:id', zValidator('param', IdParams), async (c) => {
        const { id } = c.req.valid('param')
        await cancel(id)
        return c.body(null, 204)
    })
