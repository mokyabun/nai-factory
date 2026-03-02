import { asc, desc, eq } from 'drizzle-orm'
import { generateKeyBetween } from 'fractional-indexing-jittered'
import { db, projects, scenes } from '@/db'

export async function listScenes(projectId: number) {
    return db
        .select()
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(asc(scenes.displayOrder), asc(scenes.id))
}

export async function getSceneById(id: number) {
    const [scene] = await db.select().from(scenes).where(eq(scenes.id, id))
    return scene ?? null
}

export async function createScene(projectId: number, name: string) {
    const [proj] = await db.select().from(projects).where(eq(projects.id, projectId))
    if (!proj) return null

    const [last] = await db
        .select({ displayOrder: scenes.displayOrder })
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(desc(scenes.displayOrder))
        .limit(1)

    const displayOrder = generateKeyBetween(last?.displayOrder ?? null, null)
    const [created] = await db.insert(scenes).values({ projectId, name, displayOrder }).returning()
    return created!
}

export async function updateScene(id: number, data: { name?: string }) {
    const [updated] = await db
        .update(scenes)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(scenes.id, id))
        .returning()

    return updated ?? null
}

export async function reorderScene(id: number, prevId: number | null, nextId: number | null) {
    let prevOrder: string | null = null
    let nextOrder: string | null = null

    if (prevId) {
        const [prev] = await db
            .select({ displayOrder: scenes.displayOrder })
            .from(scenes)
            .where(eq(scenes.id, prevId))
        prevOrder = prev?.displayOrder ?? null
    }

    if (nextId) {
        const [next] = await db
            .select({ displayOrder: scenes.displayOrder })
            .from(scenes)
            .where(eq(scenes.id, nextId))
        nextOrder = next?.displayOrder ?? null
    }

    const displayOrder = generateKeyBetween(prevOrder, nextOrder)

    const [updated] = await db
        .update(scenes)
        .set({ displayOrder, updatedAt: new Date().toISOString() })
        .where(eq(scenes.id, id))
        .returning()

    return updated ?? null
}

export async function deleteScene(id: number) {
    const [scene] = await db.select().from(scenes).where(eq(scenes.id, id))
    if (!scene) return false

    await db.delete(scenes).where(eq(scenes.id, id))
    // Cascade handles variations, images, queue items
    // TODO: delete image files via imageService

    return true
}
