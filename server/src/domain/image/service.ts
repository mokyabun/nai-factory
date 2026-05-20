import { desc, eq } from 'drizzle-orm'
import { status } from 'elysia'
import { db, images, scenes } from '../../db'
import { remove as removeFile } from '../../services'
import { displayOrderBetween, requireEntity } from '../../shared'

async function getSiblingOrder(id: number, sceneId: number, label: string) {
    const [image] = await db
        .select({ sceneId: images.sceneId, displayOrder: images.displayOrder })
        .from(images)
        .where(eq(images.id, id))

    const sibling = requireEntity(image, `${label} image not found`)
    if (sibling.sceneId !== sceneId) throw status(400, `${label} image belongs to another scene`)

    return sibling.displayOrder
}

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
    await removeFile(image.filePath, image.thumbnailPath ?? null)

    return true
}

// Images are displayed in DESC displayOrder (newest first), so:
//   prevId = lower displayOrder value (fractional position before)
//   nextId = higher displayOrder value (fractional position after)
// generateKeyBetween(a, b) requires a < b  →  standard order: (prevOrder, nextOrder)
export async function reorder(id: number, prevId: number | null, nextId: number | null) {
    const [img] = await db.select({ sceneId: images.sceneId }).from(images).where(eq(images.id, id))
    if (!img) throw status(404, 'Image not found')

    const prevOrder = prevId ? await getSiblingOrder(prevId, img.sceneId, 'Previous') : null
    const nextOrder = nextId ? await getSiblingOrder(nextId, img.sceneId, 'Next') : null

    const displayOrder = displayOrderBetween(prevOrder, nextOrder)
    const [updated] = await db
        .update(images)
        .set({ displayOrder })
        .where(eq(images.id, id))
        .returning()
    return updated
}
