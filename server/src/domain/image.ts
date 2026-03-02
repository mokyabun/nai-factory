import { existsSync } from 'node:fs'
import { desc, eq } from 'drizzle-orm'
import { Elysia, status, t } from 'elysia'
import { db } from '@/db'
import { images, projects, scenes } from '@/db/schema'

const ImageModel = {
    getParams: t.Object({ id: t.Numeric() }),
}

async function get(sceneId: number) {
    const [s] = await db.select().from(scenes).where(eq(scenes.id, sceneId))

    if (!s) throw status(404, 'Scene not found')

    return db
        .select()
        .from(images)
        .where(eq(images.sceneId, sceneId))
        .orderBy(desc(images.displayOrder))
}

async function remove(id: number) {
    const [image] = await db.select().from(images).where(eq(images.id, id))

    if (!image) throw status(404, 'Image not found')

    await db.delete(images).where(eq(images.id, id))

    // Decrement imageCount on scene
    const [s] = await db
        .select({ imageCount: scenes.imageCount })
        .from(scenes)
        .where(eq(scenes.id, image.sceneId))

    if (s) {
        await db
            .update(scenes)
            .set({ imageCount: Math.max(0, (s.imageCount ?? 0) - 1) })
            .where(eq(scenes.id, image.sceneId))
    }

    return status(204)
}

async function setThumbnail(id: number) {
    const [image] = await db.select().from(images).where(eq(images.id, id))

    if (!image) throw status(404, 'Image not found')

    const [s] = await db
        .select({ projectId: scenes.projectId })
        .from(scenes)
        .where(eq(scenes.id, image.sceneId))

    if (!s) throw status(404, 'Scene not found')

    const [updated] = await db
        .update(projects)
        .set({ thumbnailImageId: id, updatedAt: new Date().toISOString() })
        .where(eq(projects.id, s.projectId))
        .returning()

    return updated
}

export const image = new Elysia()
    .get('/images', ({ query }) => get(query.sceneId), {
        query: t.Object({ sceneId: t.Numeric() }),
    })
    .get(
        '/images/:id',
        async ({ params }) => {
            const id = Number(params.id)
            const [img] = await db.select().from(images).where(eq(images.id, id))
            if (!img) throw status(404, 'Image not found')
            return img
        },
        { params: ImageModel.getParams },
    )
    .get(
        '/images/:id/file',
        async ({ params, set }) => {
            const id = Number(params.id)
            const [img] = await db.select().from(images).where(eq(images.id, id))
            if (!img) throw status(404, 'Image not found')
            if (!img.filePath || !existsSync(img.filePath))
                throw status(404, 'Image file not found')

            set.headers['Cache-Control'] = 'public, max-age=31536000, immutable'
            set.headers['Content-Type'] = 'image/png'
            return Bun.file(img.filePath)
        },
        { params: ImageModel.getParams },
    )
    .get(
        '/thumbnails/:id/file',
        async ({ params, set }) => {
            const id = Number(params.id)
            const [img] = await db.select().from(images).where(eq(images.id, id))
            if (!img) throw status(404, 'Image not found')

            const servePath =
                img.thumbnailPath && existsSync(img.thumbnailPath)
                    ? img.thumbnailPath
                    : img.filePath

            if (!servePath || !existsSync(servePath)) throw status(404, 'Image file not found')

            set.headers['Cache-Control'] = 'public, max-age=3600'
            set.headers['Content-Type'] = 'image/png'
            return Bun.file(servePath)
        },
        { params: ImageModel.getParams },
    )
    .delete('/images/:id', ({ params }) => remove(Number(params.id)), {
        params: ImageModel.getParams,
    })
    .patch('/images/:id/set-thumbnail', ({ params }) => setThumbnail(Number(params.id)), {
        params: ImageModel.getParams,
    })
