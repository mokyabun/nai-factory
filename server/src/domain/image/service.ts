import { desc, eq } from 'drizzle-orm'
import { status } from 'elysia'
import { generateKeyBetween } from 'fractional-indexing-jittered'
import { db, images, scenes } from '@/db'
import * as imageService from '@/services/image'

export async function getAllBySceneId(sceneId: number) {
    const [scene] = await db.select().from(scenes).where(eq(scenes.id, sceneId))

    if (!scene) {
        return null
    }

    return db
        .select()
        .from(images)
        .where(eq(images.sceneId, sceneId))
        .orderBy(desc(images.displayOrder))
}

export async function remove(id: number) {
    const [image] = await db.select().from(images).where(eq(images.id, id))

    if (!image) {
        return null
    }

    await db.delete(images).where(eq(images.id, id))
    await imageService.remove(image.filePath, image.thumbnailPath ?? null)

    return true
}

// Images are displayed in DESC displayOrder, so:
//   prevId = visually before = higher displayOrder
//   nextId = visually after  = lower displayOrder
// generateKeyBetween(a, b) requires a < b  →  swap args: (nextOrder, prevOrder)
export async function reorder(id: number, prevId: number | null, nextId: number | null) {
    const [img] = await db.select({ sceneId: images.sceneId }).from(images).where(eq(images.id, id))
    if (!img) throw status(404, 'Image not found')

    let prevOrder: string | null = null
    let nextOrder: string | null = null

    if (prevId) {
        const [prev] = await db.select({ displayOrder: images.displayOrder }).from(images).where(eq(images.id, prevId))
        if (!prev) throw status(404, 'Previous image not found')
        prevOrder = prev.displayOrder
    }

    if (nextId) {
        const [next] = await db.select({ displayOrder: images.displayOrder }).from(images).where(eq(images.id, nextId))
        if (!next) throw status(404, 'Next image not found')
        nextOrder = next.displayOrder
    }

    const displayOrder = generateKeyBetween(nextOrder, prevOrder)
    const [updated] = await db.update(images).set({ displayOrder }).where(eq(images.id, id)).returning()
    return updated
}
