import { asc, eq, inArray } from 'drizzle-orm'
import { status } from 'elysia'
import { db } from '@/db'
import { projects, queueItems, scenes } from '@/db/schema'
import { queueManager, type EnqueuePosition } from '@/services/queue-manager'

export async function get(projectId?: number) {
    const rows = projectId
        ? await db
              .select()
              .from(queueItems)
              .where(eq(queueItems.projectId, projectId))
              .orderBy(asc(queueItems.sortIndex))
        : await db.select().from(queueItems).orderBy(asc(queueItems.sortIndex))

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

export async function enqueueAll(projectId: number, position: EnqueuePosition = 'back') {
    const [proj] = await db.select().from(projects).where(eq(projects.id, projectId))
    if (!proj) throw status(404, 'Project not found')

    const projectScenes = await db
        .select()
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(asc(scenes.displayOrder), asc(scenes.id))

    const created = []
    for (const s of projectScenes) {
        const item = await queueManager.add(s.id, position)
        created.push(item)
    }

    return { queued: created.length, items: created }
}

export async function enqueueBulk(sceneIds: number[], position: EnqueuePosition = 'back') {
    const created = []
    for (const sceneId of sceneIds) {
        const item = await queueManager.add(sceneId, position)
        created.push(item)
    }
    return { queued: created.length, items: created }
}

export async function cancel(id: number) {
    const [item] = await db.select().from(queueItems).where(eq(queueItems.id, id))
    if (!item) throw status(404, 'Queue item not found')

    queueManager.cancel([id])
    return { success: true }
}

export async function clearAll(sceneId?: number) {
    const rows = sceneId
        ? await db.select().from(queueItems).where(eq(queueItems.sceneId, sceneId))
        : await db.select().from(queueItems)

    const ids = rows.map((r) => r.id)
    if (ids.length > 0) queueManager.cancel(ids)
    return { cancelled: ids.length }
}
