import { asc, desc, eq, inArray } from 'drizzle-orm'
import { Elysia, status, t } from 'elysia'
import { db, projects, queueItems, scenes } from '@/db'
import { queueManager, type EnqueuePosition } from '@/services/queue-manager'

export const queueRoutes = new Elysia({ prefix: '/queue' })
    .get(
        '/',
        async ({ query }) => {
            const rows = query.projectId
                ? await db
                      .select()
                      .from(queueItems)
                      .where(eq(queueItems.projectId, query.projectId))
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
            return rows.map((r) => ({
                ...r,
                sceneName: sceneNameMap.get(r.sceneId) ?? null,
            }))
        },
        { query: t.Object({ projectId: t.Optional(t.Numeric()) }) },
    )

    .get('/status', () => queueManager.getStatus())

    .post(
        '/enqueue',
        ({ body }) =>
            queueManager.enqueue(body.sceneId, body.variationId ?? null, body.position ?? 'back'),
        {
            body: t.Object({
                sceneId: t.Number(),
                variationId: t.Optional(t.Nullable(t.Number())),
                position: t.Optional(
                    t.Union([t.Literal('back'), t.Literal('front')], { default: 'back' }),
                ),
            }),
        },
    )

    .post(
        '/enqueue-all',
        async ({ body }) => {
            const [proj] = await db.select().from(projects).where(eq(projects.id, body.projectId))
            if (!proj) throw status(404, 'Project not found')

            const projectScenes = await db
                .select()
                .from(scenes)
                .where(eq(scenes.projectId, body.projectId))
                .orderBy(asc(scenes.displayOrder), asc(scenes.id))

            const position: EnqueuePosition = body.position ?? 'back'
            const created = []
            for (const s of projectScenes) {
                const item = await queueManager.enqueue(s.id, null, position)
                created.push(item)
            }

            return { queued: created.length, items: created }
        },
        {
            body: t.Object({
                projectId: t.Number(),
                position: t.Optional(
                    t.Union([t.Literal('back'), t.Literal('front')], { default: 'back' }),
                ),
            }),
        },
    )

    .post('/start', () => {
        queueManager.startQueue()
        return queueManager.getStatus()
    })

    .post('/stop', () => {
        queueManager.stopQueue()
        return queueManager.getStatus()
    })

    .delete(
        '/:id',
        async ({ params }) => {
            const [item] = await db.select().from(queueItems).where(eq(queueItems.id, params.id))
            if (!item) throw status(404, 'Queue item not found')

            queueManager.cancelJobs([params.id])
            return { success: true }
        },
        { params: t.Object({ id: t.Numeric() }) },
    )
