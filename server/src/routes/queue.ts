import { asc, desc, eq, inArray } from 'drizzle-orm'
import { Elysia, status, t } from 'elysia'
import { db } from '@/db'
import { projects, queueItems, scenes } from '@/db/schema'
import { queueManager, type EnqueuePosition } from '@/services/queue-manager'

const QueueModel = {
    getParams: t.Object({ id: t.Numeric() }),

    enqueueBody: t.Object({
        sceneId: t.Number(),
        variationId: t.Optional(t.Nullable(t.Number())),
        position: t.Optional(t.Union([t.Literal('back'), t.Literal('front')], { default: 'back' })),
    }),

    enqueueAllBody: t.Object({
        projectId: t.Number(),
        position: t.Optional(t.Union([t.Literal('back'), t.Literal('front')], { default: 'back' })),
    }),
}

async function get(projectId?: number) {
    const rows = projectId
        ? await db
              .select()
              .from(queueItems)
              .where(eq(queueItems.projectId, projectId))
              .orderBy(desc(queueItems.priority), asc(queueItems.createdAt))
        : await db
              .select()
              .from(queueItems)
              .orderBy(desc(queueItems.priority), asc(queueItems.createdAt))

    const sceneIds = [...new Set(rows.map((r) => r.sceneId))]
    const sceneRows =
        sceneIds.length > 0
            ? await db
                  .select({ id: scenes.id, name: scenes.name })
                  .from(scenes)
                  .where(inArray(scenes.id, sceneIds))
            : []

    const sceneNameMap = new Map(sceneRows.map((s) => [s.id, s.name]))
    return rows.map((r) => ({ ...r, sceneName: sceneNameMap.get(r.sceneId) ?? null }))
}

async function enqueueAll(projectId: number, position: EnqueuePosition = 'back') {
    const [proj] = await db.select().from(projects).where(eq(projects.id, projectId))
    if (!proj) throw status(404, 'Project not found')

    const projectScenes = await db
        .select()
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(asc(scenes.displayOrder), asc(scenes.id))

    const created = []
    for (const s of projectScenes) {
        const item = await queueManager.enqueue(s.id, null, position)
        created.push(item)
    }

    return { queued: created.length, items: created }
}

async function cancel(id: number) {
    const [item] = await db.select().from(queueItems).where(eq(queueItems.id, id))
    if (!item) throw status(404, 'Queue item not found')

    queueManager.cancelJobs([id])
    return { success: true }
}

export const queue = new Elysia({ prefix: '/queue' })
    .get('/', ({ query }) => get(query.projectId), {
        query: t.Object({ projectId: t.Optional(t.Numeric()) }),
    })
    .get('/status', () => queueManager.getQueueStatus())
    .post(
        '/enqueue',
        ({ body }) =>
            queueManager.enqueue(body.sceneId, body.variationId ?? null, body.position ?? 'back'),
        { body: QueueModel.enqueueBody },
    )
    .post('/enqueue-all', ({ body }) => enqueueAll(body.projectId, body.position ?? 'back'), {
        body: QueueModel.enqueueAllBody,
    })
    .post('/start', () => {
        queueManager.startQueue()
        return queueManager.getQueueStatus()
    })
    .post('/stop', () => {
        queueManager.stopQueue()
        return queueManager.getQueueStatus()
    })
    .delete('/:id', ({ params }) => cancel(params.id), { params: QueueModel.getParams })
