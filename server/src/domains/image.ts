import { zValidator } from '@hono/zod-validator'
import { IdParams, ImageGetQuery, ImageOrderPatchBody, ImagePatchBody } from '@nai-factory/types'
import { desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { db, images, scenes } from '#/db'
import { remove as removeFile } from '#/services'
import { displayOrderBetween, requireEntity } from '#/shared'

async function getSiblingOrder(id: number, sceneId: number, label: string) {
    const [image] = await db
        .select({ sceneId: images.sceneId, displayOrder: images.displayOrder })
        .from(images)
        .where(eq(images.id, id))

    const sibling = requireEntity(image, `${label} image not found`)
    if (sibling.sceneId !== sceneId) {
        throw new HTTPException(400, { message: `${label} image belongs to another scene` })
    }

    return sibling.displayOrder
}

async function getAllBySceneId(sceneId: number) {
    const [scene] = await db.select().from(scenes).where(eq(scenes.id, sceneId))
    if (!scene) return null

    return db
        .select()
        .from(images)
        .where(eq(images.sceneId, sceneId))
        .orderBy(desc(images.createdAt), desc(images.id))
}

async function update(id: number, data: ImagePatchBody) {
    const [updated] = await db.update(images).set(data).where(eq(images.id, id)).returning()
    return updated ?? null
}

async function reorder(id: number, prevId: number | null, nextId: number | null) {
    const [image] = await db
        .select({ sceneId: images.sceneId })
        .from(images)
        .where(eq(images.id, id))
    if (!image) throw new HTTPException(404, { message: 'Image not found' })

    const prevOrder = prevId ? await getSiblingOrder(prevId, image.sceneId, 'Previous') : null
    const nextOrder = nextId ? await getSiblingOrder(nextId, image.sceneId, 'Next') : null
    const [updated] = await db
        .update(images)
        .set({ displayOrder: displayOrderBetween(prevOrder, nextOrder) })
        .where(eq(images.id, id))
        .returning()

    return updated
}

async function remove(id: number) {
    const [image] = await db.select().from(images).where(eq(images.id, id))
    if (!image) return false

    await db.delete(images).where(eq(images.id, id))
    await removeFile(image.filePath, image.thumbnailPath ?? null)

    return true
}

export const image = new Hono()
    .get('/', zValidator('query', ImageGetQuery), async (c) => {
        const result = await getAllBySceneId(c.req.valid('query').sceneId)
        if (!result) throw new HTTPException(404, { message: 'Scene not found' })

        return c.json(result)
    })
    .patch('/:id', zValidator('param', IdParams), zValidator('json', ImagePatchBody), async (c) => {
        const updated = await update(c.req.valid('param').id, c.req.valid('json'))
        if (!updated) throw new HTTPException(404, { message: 'Image not found' })

        return c.json(updated)
    })
    .patch(
        '/:id/order',
        zValidator('param', IdParams),
        zValidator('json', ImageOrderPatchBody),
        async (c) => {
            const { prevId, nextId } = c.req.valid('json')
            return c.json(await reorder(c.req.valid('param').id, prevId, nextId))
        },
    )
    .delete('/:id', zValidator('param', IdParams), async (c) => {
        if (!(await remove(c.req.valid('param').id))) {
            throw new HTTPException(404, { message: 'Image not found' })
        }

        return c.body(null, 204)
    })
