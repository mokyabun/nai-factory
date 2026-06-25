import { zValidator } from '@hono/zod-validator'
import { IdParams, ImageGetQuery, ImageOrderPatchBody, ImagePatchBody } from '@nai-factory/shared'
import { asc, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { db, images, scenes } from '@/db'
import logger from '@/logger'
import { remove as removeFile } from '@/services'
import { planDisplayOrderUpdate } from '@/services/order'

const log = logger.child({ module: 'image-domain' })

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
    if (updated)
        log.debug(
            { imageId: id, sceneId: updated.sceneId, fields: Object.keys(data) },
            'Image updated',
        )
    return updated ?? null
}

async function reorder(id: number, prevId: number | null, nextId: number | null) {
    const [image] = await db
        .select({ sceneId: images.sceneId })
        .from(images)
        .where(eq(images.id, id))
    if (!image) throw new HTTPException(404, { message: 'Image not found' })

    const items = await db
        .select({ id: images.id, displayOrder: images.displayOrder })
        .from(images)
        .where(eq(images.sceneId, image.sceneId))
        .orderBy(asc(images.displayOrder), asc(images.id))
    const plan = planDisplayOrderUpdate({
        entity: 'image',
        items,
        id,
        prevId,
        nextId,
        logContext: { sceneId: image.sceneId },
    })
    if (!plan) throw new HTTPException(404, { message: 'Image not found' })

    const updated = db.transaction(() => {
        if (plan.type === 'rebalance') {
            for (const update of plan.updates) {
                db.update(images)
                    .set({ displayOrder: update.displayOrder })
                    .where(eq(images.id, update.id))
                    .run()
            }
        } else {
            db.update(images)
                .set({ displayOrder: plan.displayOrder })
                .where(eq(images.id, id))
                .run()
        }

        return db.select().from(images).where(eq(images.id, id)).get()
    })

    if (updated) {
        log.debug({ imageId: id, sceneId: image.sceneId, planType: plan.type }, 'Image reordered')
    }

    return updated
}

async function remove(id: number) {
    const [image] = await db.select().from(images).where(eq(images.id, id))
    if (!image) return false

    await db.delete(images).where(eq(images.id, id))
    await removeFile(image.filePath, image.thumbnailPath ?? null)

    log.debug({ imageId: id, sceneId: image.sceneId }, 'Image deleted')
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
