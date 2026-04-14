import { asc, desc, eq, sql } from 'drizzle-orm'
import { status } from 'elysia'
import { generateKeyBetween } from 'fractional-indexing-jittered'
import type { PromptVariable } from '@/types'
import { db } from '@/db'
import { images, projects, scenes, vibeTransfers } from '@/db/schema'

export async function get(projectId: number) {
    const [proj] = await db.select().from(projects).where(eq(projects.id, projectId))
    if (!proj) throw status(404, 'Project not found')

    return db
        .select({
            id: scenes.id,
            projectId: scenes.projectId,
            displayOrder: scenes.displayOrder,
            thumbnailImageId: scenes.thumbnailImageId,
            name: scenes.name,
            variations: scenes.variations,
            createdAt: scenes.createdAt,
            updatedAt: scenes.updatedAt,
            imageCount: sql<number>`(select count(*) from images where images.scene_id = scenes.id)`,
            queueCount: sql<number>`(select count(*) from queue_items where queue_items.scene_id = scenes.id)`,
        })
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(asc(scenes.displayOrder), asc(scenes.id))
}

export async function getById(id: number) {
    const [scene] = await db.select().from(scenes).where(eq(scenes.id, id))
    if (!scene) throw status(404, 'Scene not found')

    const sceneImages = await db
        .select()
        .from(images)
        .where(eq(images.sceneId, id))
        .orderBy(desc(images.displayOrder))

    return { ...scene, images: sceneImages }
}

export async function getWorkspaceData(projectId: number) {
    const [proj] = await db.select().from(projects).where(eq(projects.id, projectId))
    if (!proj) throw status(404, 'Project not found')

    const vibeList = await db
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

    return { ...proj, vibeTransfers: vibeList }
}

export async function create(projectId: number, name: string) {
    const [proj] = await db.select().from(projects).where(eq(projects.id, projectId))
    if (!proj) throw status(404, 'Project not found')

    const [last] = await db
        .select({ displayOrder: scenes.displayOrder })
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(desc(scenes.displayOrder))
        .limit(1)

    const displayOrder = generateKeyBetween(last?.displayOrder ?? null, null)
    const [created] = await db.insert(scenes).values({ projectId, name, displayOrder }).returning()

    return created
}

export async function update(id: number, body: { name?: string; variations?: PromptVariable[] }) {
    const [existing] = await db.select().from(scenes).where(eq(scenes.id, id))
    if (!existing) throw status(404, 'Scene not found')

    const [updated] = await db
        .update(scenes)
        .set({ ...body, updatedAt: new Date().toISOString() })
        .where(eq(scenes.id, id))
        .returning()

    return updated
}

export async function reorder(id: number, prevId: number | null, nextId: number | null) {
    const [existing] = await db.select().from(scenes).where(eq(scenes.id, id))
    if (!existing) throw status(404, 'Scene not found')

    let prevOrder: string | null = null
    let nextOrder: string | null = null

    if (prevId) {
        const [prev] = await db
            .select({ displayOrder: scenes.displayOrder })
            .from(scenes)
            .where(eq(scenes.id, prevId))
        if (!prev) throw status(404, 'Previous scene not found')
        prevOrder = prev.displayOrder
    }

    if (nextId) {
        const [next] = await db
            .select({ displayOrder: scenes.displayOrder })
            .from(scenes)
            .where(eq(scenes.id, nextId))
        if (!next) throw status(404, 'Next scene not found')
        nextOrder = next.displayOrder
    }

    const displayOrder = generateKeyBetween(prevOrder, nextOrder)
    const [updated] = await db
        .update(scenes)
        .set({ displayOrder, updatedAt: new Date().toISOString() })
        .where(eq(scenes.id, id))
        .returning()

    return updated
}

export async function remove(id: number) {
    const [existing] = await db.select().from(scenes).where(eq(scenes.id, id))
    if (!existing) throw status(404, 'Scene not found')

    await db.delete(scenes).where(eq(scenes.id, id))
    return { success: true }
}

export async function duplicate(id: number) {
    const [existing] = await db.select().from(scenes).where(eq(scenes.id, id))
    if (!existing) throw status(404, 'Scene not found')

    const [last] = await db
        .select({ displayOrder: scenes.displayOrder })
        .from(scenes)
        .where(eq(scenes.projectId, existing.projectId))
        .orderBy(desc(scenes.displayOrder))
        .limit(1)

    const displayOrder = generateKeyBetween(last?.displayOrder ?? null, null)
    const [created] = await db
        .insert(scenes)
        .values({
            projectId: existing.projectId,
            name: `${existing.name} (copy)`,
            displayOrder,
            variations: existing.variations,
        })
        .returning()

    return created
}
