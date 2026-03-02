import { Elysia, status, t } from 'elysia'
import * as vibeTransferService from '@/services/vibe-transfer'

export const vibeTransferRoutes = new Elysia({
    prefix: '/projects/:projectId/vibe-transfers',
})
    .get('/', ({ params }) => vibeTransferService.listByProject(params.projectId), {
        params: t.Object({ projectId: t.Numeric() }),
    })

    .post(
        '/upload',
        ({ params, body }) => vibeTransferService.upload(params.projectId, body.image),
        {
            params: t.Object({ projectId: t.Numeric() }),
            body: t.Object({ image: t.File({ type: 'image' }) }),
        },
    )

    .patch(
        '/:id',
        async ({ params, body }) => {
            const updated = await vibeTransferService.update(params.id, body)
            if (!updated) throw status(404, 'Vibe transfer not found')
            return updated
        },
        {
            params: t.Object({ projectId: t.Numeric(), id: t.Numeric() }),
            body: t.Object({
                referenceStrength: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
                informationExtracted: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
            }),
        },
    )

    .patch(
        '/:id/order',
        async ({ params, body }) => {
            const updated = await vibeTransferService.reorder(params.id, body.prevId, body.nextId)
            if (!updated) throw status(404, 'Vibe transfer not found')
            return updated
        },
        {
            params: t.Object({ projectId: t.Numeric(), id: t.Numeric() }),
            body: t.Object({
                prevId: t.Nullable(t.Number()),
                nextId: t.Nullable(t.Number()),
            }),
        },
    )

    .delete(
        '/:id',
        async ({ params }) => {
            const deleted = await vibeTransferService.remove(params.id)
            if (!deleted) throw status(404, 'Vibe transfer not found')
            return { success: true }
        },
        { params: t.Object({ projectId: t.Numeric(), id: t.Numeric() }) },
    )
