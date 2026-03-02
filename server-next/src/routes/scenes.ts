import { desc, eq } from 'drizzle-orm'
import { Elysia, status, t } from 'elysia'
import { db, images } from '@/db'
import * as sceneService from '@/services/scene'

export const sceneRoutes = new Elysia({ prefix: '/scenes' })
    .get('/', ({ query }) => sceneService.listScenes(query.projectId), {
        query: t.Object({ projectId: t.Numeric() }),
    })

    .get(
        '/:sceneId',
        async ({ params }) => {
            const scene = await sceneService.getSceneById(params.sceneId)
            if (!scene) throw status(404, 'Scene not found')

            // Load images for this scene
            const sceneImages = await db
                .select()
                .from(images)
                .where(eq(images.sceneId, params.sceneId))
                .orderBy(desc(images.displayOrder))

            return { ...scene, images: sceneImages }
        },
        { params: t.Object({ sceneId: t.Numeric() }) },
    )

    .post(
        '/',
        async ({ body }) => {
            const created = await sceneService.createScene(body.projectId, body.name)
            if (!created) throw status(404, 'Project not found')
            return created
        },
        {
            body: t.Object({
                projectId: t.Number(),
                name: t.String({ minLength: 1 }),
            }),
        },
    )

    .patch(
        '/:sceneId',
        async ({ params, body }) => {
            const updated = await sceneService.updateScene(params.sceneId, body)
            if (!updated) throw status(404, 'Scene not found')
            return updated
        },
        {
            params: t.Object({ sceneId: t.Numeric() }),
            body: t.Object({ name: t.Optional(t.String({ minLength: 1 })) }),
        },
    )

    .patch(
        '/:sceneId/order',
        async ({ params, body }) => {
            const updated = await sceneService.reorderScene(
                params.sceneId,
                body.prevId,
                body.nextId,
            )
            if (!updated) throw status(404, 'Scene not found')
            return updated
        },
        {
            params: t.Object({ sceneId: t.Numeric() }),
            body: t.Object({
                prevId: t.Nullable(t.Number()),
                nextId: t.Nullable(t.Number()),
            }),
        },
    )

    .delete(
        '/:sceneId',
        async ({ params }) => {
            const deleted = await sceneService.deleteScene(params.sceneId)
            if (!deleted) throw status(404, 'Scene not found')
            return { success: true }
        },
        { params: t.Object({ sceneId: t.Numeric() }) },
    )
