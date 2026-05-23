import { zValidator } from '@hono/zod-validator'
import {
<<<<<<< HEAD
    type EnqueuePosition,
    IdParams,
    QueueClearQuery,
    QueueEnqueueAllBody,
    QueueEnqueueBody,
    QueueEnqueueBulkBody,
    QueueGetQuery,
} from '@nai-factory/types'
import { asc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { db, projects, queueItems, scenes } from '#/db'
import { domainEvents, queueManager } from '#/services'
import { httpError } from '#/shared'

async function get(projectId?: number) {
=======
    ClearQueueQuery,
    EnqueueAllBody,
    EnqueueBody,
    EnqueueBulkBody,
    type EnqueuePosition,
    QueueIdParams,
    QueueListQuery,
} from '@nai-factory/types'
import { asc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { db, projects, queueItems, scenes } from '#/db'
import { domainEvents, queueManager } from '#/services'

async function list(projectId?: number) {
>>>>>>> refs/remotes/origin/main
    const rows = projectId
        ? await db
              .select()
              .from(queueItems)
              .where(eq(queueItems.projectId, projectId))
              .orderBy(asc(queueItems.sortIndex))
        : await db.select().from(queueItems).orderBy(asc(queueItems.sortIndex))

    const sceneIds = [...new Set(rows.map((row) => row.sceneId))]
    const sceneRows =
        sceneIds.length > 0
            ? await db
                  .select({ id: scenes.id, name: scenes.name })
                  .from(scenes)
                  .where(inArray(scenes.id, sceneIds))
            : []
<<<<<<< HEAD
    const sceneNames = new Map(sceneRows.map((scene) => [scene.id, scene.name]))

    return rows.map((row) => ({ ...row, sceneName: sceneNames.get(row.sceneId) ?? null }))
}

async function enqueueAll(projectId: number, position: EnqueuePosition = 'back') {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId))
    if (!project) throw httpError(404, 'Project not found')
=======
    const sceneNameMap = new Map(sceneRows.map((scene) => [scene.id, scene.name]))

    return rows.map((row) => ({ ...row, sceneName: sceneNameMap.get(row.sceneId) ?? null }))
}

async function enqueueAll(projectId: number, position: EnqueuePosition) {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId))
    if (!project) throw new HTTPException(404, { message: 'Project not found' })
>>>>>>> refs/remotes/origin/main

    const projectScenes = await db
        .select()
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(asc(scenes.displayOrder), asc(scenes.id))
<<<<<<< HEAD
    const created = []
    for (const scene of projectScenes) created.push(await queueManager.add(scene.id, position))

    return { queued: created.length, items: created }
}

async function enqueueBulk(sceneIds: number[], position: EnqueuePosition = 'back') {
    const created = []
    for (const sceneId of sceneIds) created.push(await queueManager.add(sceneId, position))

    return { queued: created.length, items: created }
=======
    const items = []
    for (const scene of projectScenes) items.push(await queueManager.add(scene.id, position))
    return { queued: items.length, items }
}

async function enqueueBulk(sceneIds: number[], position: EnqueuePosition) {
    const items = []
    for (const sceneId of sceneIds) items.push(await queueManager.add(sceneId, position))
    return { queued: items.length, items }
>>>>>>> refs/remotes/origin/main
}

async function cancel(id: number) {
    const [item] = await db.select().from(queueItems).where(eq(queueItems.id, id))
<<<<<<< HEAD
    if (!item) throw httpError(404, 'Queue item not found')

=======
    if (!item) throw new HTTPException(404, { message: 'Queue item not found' })
>>>>>>> refs/remotes/origin/main
    await queueManager.cancel([id])
    return { success: true }
}

async function clearAll(sceneId?: number) {
    const rows = sceneId
        ? await db.select().from(queueItems).where(eq(queueItems.sceneId, sceneId))
        : await db.select().from(queueItems)
<<<<<<< HEAD
    await queueManager.cancel(rows.map((row) => row.id))

    return { cancelled: rows.length }
}

export const queue = new Hono()
    .get('/', zValidator('query', QueueGetQuery), async (c) =>
        c.json(await get(c.req.valid('query').projectId)),
    )
    .get('/status', async (c) => c.json(await queueManager.status()))
    .post('/enqueue', zValidator('json', QueueEnqueueBody), async (c) => {
        const { sceneId, position } = c.req.valid('json')
        const item = await queueManager.add(sceneId, position ?? 'back')
        domainEvents.invalidate('queue')

        return c.json(item, 201)
    })
    .post('/enqueue-all', zValidator('json', QueueEnqueueAllBody), async (c) => {
        const { projectId, position } = c.req.valid('json')
        const result = await enqueueAll(projectId, position ?? 'back')
        domainEvents.invalidate('queue')

        return c.json(result, 201)
    })
    .post('/enqueue-bulk', zValidator('json', QueueEnqueueBulkBody), async (c) => {
        const { sceneIds, position } = c.req.valid('json')
        const result = await enqueueBulk(sceneIds, position ?? 'back')
        domainEvents.invalidate('queue')

        return c.json(result, 201)
    })
    .post('/start', async (c) => {
        queueManager.start()
        domainEvents.invalidate('queue')
=======
    const ids = rows.map((row) => row.id)
    await queueManager.cancel(ids)
    return { cancelled: ids.length }
}

function invalidateQueue() {
    domainEvents.invalidate('queue')
}

export const queue = new Hono()
    .get('/', zValidator('query', QueueListQuery), async (c) =>
        c.json(await list(c.req.valid('query').projectId)),
    )
    .get('/status', async (c) => c.json(await queueManager.status()))
    .post('/enqueue', zValidator('json', EnqueueBody), async (c) => {
        const { sceneId, position } = c.req.valid('json')
        const item = await queueManager.add(sceneId, position)
        invalidateQueue()
        return c.json(item)
    })
    .post('/enqueue-all', zValidator('json', EnqueueAllBody), async (c) => {
        const { projectId, position } = c.req.valid('json')
        const result = await enqueueAll(projectId, position)
        invalidateQueue()
        return c.json(result)
    })
    .post('/enqueue-bulk', zValidator('json', EnqueueBulkBody), async (c) => {
        const { sceneIds, position } = c.req.valid('json')
        const result = await enqueueBulk(sceneIds, position)
        invalidateQueue()
        return c.json(result)
    })
    .post('/start', async (c) => {
        queueManager.start()
        invalidateQueue()
>>>>>>> refs/remotes/origin/main
        return c.json(await queueManager.status())
    })
    .post('/stop', async (c) => {
        queueManager.stop()
<<<<<<< HEAD
        domainEvents.invalidate('queue')
        return c.json(await queueManager.status())
    })
    .delete('/', zValidator('query', QueueClearQuery), async (c) => {
        const result = await clearAll(c.req.valid('query').sceneId)
        domainEvents.invalidate('queue')
        return c.json(result)
    })
    .delete('/:id', zValidator('param', IdParams), async (c) => {
        const result = await cancel(c.req.valid('param').id)
        domainEvents.invalidate('queue')
=======
        invalidateQueue()
        return c.json(await queueManager.status())
    })
    .delete('/', zValidator('query', ClearQueueQuery), async (c) => {
        const result = await clearAll(c.req.valid('query').sceneId)
        invalidateQueue()
        return c.json(result)
    })
    .delete('/:id', zValidator('param', QueueIdParams), async (c) => {
        const result = await cancel(c.req.valid('param').id)
        invalidateQueue()
>>>>>>> refs/remotes/origin/main
        return c.json(result)
    })
