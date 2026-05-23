import { zValidator } from '@hono/zod-validator'
<<<<<<< HEAD
import { IdParams, ImageGetQuery, ImagePatchBody } from '@nai-factory/types'
import { desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db, images, scenes } from '#/db'
import { remove as removeFile } from '#/services'
=======
import { ImageIdParams, ImageListQuery, ReorderImageBody } from '@nai-factory/types'
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
>>>>>>> refs/remotes/origin/main

async function getAllBySceneId(sceneId: number) {
    const [scene] = await db.select().from(scenes).where(eq(scenes.id, sceneId))
    if (!scene) return null

    return db
        .select()
        .from(images)
        .where(eq(images.sceneId, sceneId))
        .orderBy(desc(images.displayOrder))
}

<<<<<<< HEAD
async function update(id: number, data: ImagePatchBody) {
    const [updated] = await db.update(images).set(data).where(eq(images.id, id)).returning()

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
        const sceneId = c.req.valid('query').sceneId

        const result = await getAllBySceneId(sceneId)
        if (!result) return c.text('Scene not found', 404)

        return c.json(result)
    })
    .patch('/:id', zValidator('param', IdParams), zValidator('json', ImagePatchBody), async (c) => {
        const id = c.req.valid('param').id
        const body = c.req.valid('json')

        const updated = await update(id, body)
        if (!updated) return c.text('Image not found', 404)

        return c.json(updated)
    })
    .delete('/:id', zValidator('param', IdParams), async (c) => {
        const id = c.req.valid('param').id

        if (!(await remove(id))) return c.text('Image not found', 404)

=======
async function remove(id: number) {
    const [image] = await db.select().from(images).where(eq(images.id, id))
    if (!image) return null

    await db.delete(images).where(eq(images.id, id))
    await removeFile(image.filePath, image.thumbnailPath ?? null)
    return true
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

export const image = new Hono()
    .get('/', zValidator('query', ImageListQuery), async (c) => {
        const results = await getAllBySceneId(c.req.valid('query').sceneId)
        if (!results) throw new HTTPException(404, { message: 'Scene not found' })
        return c.json(results)
    })
    .patch(
        '/:id/order',
        zValidator('param', ImageIdParams),
        zValidator('json', ReorderImageBody),
        async (c) => {
            const { prevId, nextId } = c.req.valid('json')
            return c.json(await reorder(c.req.valid('param').id, prevId, nextId))
        },
    )
    .delete('/:id', zValidator('param', ImageIdParams), async (c) => {
        const success = await remove(c.req.valid('param').id)
        if (!success) throw new HTTPException(404, { message: 'Image not found' })
>>>>>>> refs/remotes/origin/main
        return c.body(null, 204)
    })
