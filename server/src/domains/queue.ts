import { zValidator } from '@hono/zod-validator'
import {
    IdParams,
    QueueClearQuery,
    QueueEnqueueAllBody,
    QueueEnqueueBody,
    QueueEnqueueBulkBody,
    QueueGetQuery,
} from '@nai-factory/types'
import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { db, projects, queueItems, scenes } from '../db'
import { domainEvents, queueManager } from '../services'

async function get(projectId?: number) {
    const rows = await db
        .select({
            id: queueItems.id,
            projectId: queueItems.projectId,
            sceneId: queueItems.sceneId,
            sceneName: scenes.name,
            variationCount: queueItems.variationCount,
            sortIndex: queueItems.sortIndex,
        })
        .from(queueItems)
        .innerJoin(scenes, eq(queueItems.sceneId, scenes.id))
        .where(projectId ? eq(queueItems.projectId, projectId) : undefined)
        .orderBy(asc(queueItems.sortIndex))

    return rows
}

async function enqueue(sceneId: number, position: QueueEnqueueBody['position'] = 'back') {
    try {
        return await queueManager.add(sceneId, position)
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
    for (const scene of rows) {
        items.push(await enqueue(scene.id, position))
    }

    return items
}

async function enqueueBulk(
    sceneIds: number[],
    position: QueueEnqueueBulkBody['position'] = 'back',
) {
    const items = []
    for (const sceneId of sceneIds) {
        items.push(await enqueue(sceneId, position))
    }
    return items
}

async function cancel(id: number) {
    const [item] = await db
        .select({ id: queueItems.id })
        .from(queueItems)
        .where(eq(queueItems.id, id))
    if (!item) throw new HTTPException(404, { message: 'Queue item not found' })

    await queueManager.cancel([id])
}

async function clear(sceneId?: number) {
    const rows = await db
        .select({ id: queueItems.id })
        .from(queueItems)
        .where(sceneId ? eq(queueItems.sceneId, sceneId) : undefined)

    await queueManager.cancel(rows.map((row) => row.id))
    return { cancelled: rows.length }
}

function invalidateQueue() {
    domainEvents.invalidate('queue')
}

export const queue = new Hono()
    .get('/', zValidator('query', QueueGetQuery), async (c) => {
        const query = c.req.valid('query')
        return c.json(await get(query.projectId))
    })
    .get('/status', async (c) => c.json(await queueManager.status()))
    .post('/enqueue', zValidator('json', QueueEnqueueBody), async (c) => {
        const body = c.req.valid('json')
        const item = await enqueue(body.sceneId, body.position)
        invalidateQueue()
        return c.json(item, 201)
    })
    .post('/enqueue-all', zValidator('json', QueueEnqueueAllBody), async (c) => {
        const body = c.req.valid('json')
        const items = await enqueueAll(body.projectId, body.position)
        invalidateQueue()
        return c.json(items, 201)
    })
    .post('/enqueue-bulk', zValidator('json', QueueEnqueueBulkBody), async (c) => {
        const body = c.req.valid('json')
        const items = await enqueueBulk(body.sceneIds, body.position)
        invalidateQueue()
        return c.json(items, 201)
    })
    .post('/start', async (c) => {
        queueManager.start()
        invalidateQueue()
        return c.json(await queueManager.status())
    })
    .post('/stop', async (c) => {
        queueManager.stop()
        invalidateQueue()
        return c.json(await queueManager.status())
    })
    .delete('/', zValidator('query', QueueClearQuery), async (c) => {
        const query = c.req.valid('query')
        const result = await clear(query.sceneId)
        invalidateQueue()
        return c.json(result)
    })
    .delete('/:id', zValidator('param', IdParams), async (c) => {
        const { id } = c.req.valid('param')
        await cancel(id)
        invalidateQueue()
        return c.body(null, 204)
    })
