import { existsSync } from 'node:fs'
import { desc, eq } from 'drizzle-orm'
import { Elysia, status, t } from 'elysia'
import { db, images, projects, scenes } from '@/db'

export const imageRoutes = new Elysia()
    .get(
        '/images',
        async ({ query }) => {
            const [s] = await db.select().from(scenes).where(eq(scenes.id, query.sceneId))
            if (!s) throw status(404, 'Scene not found')

            return db
                .select()
                .from(images)
                .where(eq(images.sceneId, query.sceneId))
                .orderBy(desc(images.displayOrder))
        },
        { query: t.Object({ sceneId: t.Numeric() }) },
    )

    .get(
        '/images/:id',
        async ({ params }) => {
            const [img] = await db.select().from(images).where(eq(images.id, params.id))
            if (!img) throw status(404, 'Image not found')
            return img
        },
        { params: t.Object({ id: t.Numeric() }) },
    )

    .get(
        '/images/:id/file',
        async ({ params, set }) => {
            const [img] = await db.select().from(images).where(eq(images.id, params.id))
            if (!img) throw status(404, 'Image not found')
            if (!img.filePath || !existsSync(img.filePath))
                throw status(404, 'Image file not found')

            set.headers['Cache-Control'] = 'public, max-age=31536000, immutable'
            set.headers['Content-Type'] = 'image/png'
            return Bun.file(img.filePath)
        },
        { params: t.Object({ id: t.Numeric() }) },
    )

    .get(
        '/thumbnails/:id/file',
        async ({ params, set }) => {
            const [img] = await db.select().from(images).where(eq(images.id, params.id))
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
        { params: t.Object({ id: t.Numeric() }) },
    )

    .delete(
        '/images/:id',
        async ({ params }) => {
            const [image] = await db.select().from(images).where(eq(images.id, params.id))
            if (!image) throw status(404, 'Image not found')

            await db.delete(images).where(eq(images.id, params.id))

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
        },
        { params: t.Object({ id: t.Numeric() }) },
    )

    .patch(
        '/images/:id/set-thumbnail',
        async ({ params }) => {
            const [image] = await db.select().from(images).where(eq(images.id, params.id))
            if (!image) throw status(404, 'Image not found')

            const [s] = await db
                .select({ projectId: scenes.projectId })
                .from(scenes)
                .where(eq(scenes.id, image.sceneId))
            if (!s) throw status(404, 'Scene not found')

            const [updated] = await db
                .update(projects)
                .set({
                    thumbnailImageId: params.id,
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(projects.id, s.projectId))
                .returning()

            return updated
        },
        { params: t.Object({ id: t.Numeric() }) },
    )
