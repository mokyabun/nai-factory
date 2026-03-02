import { Elysia, status, t } from 'elysia'
import * as variationService from '@/services/variation'

export const variationRoutes = new Elysia({
    prefix: '/scenes/:sceneId/variations',
})
    .get('/', ({ params }) => variationService.listByScene(params.sceneId), {
        params: t.Object({ sceneId: t.Numeric() }),
    })

    .post('/', ({ params, body }) => variationService.create(params.sceneId, body.variables), {
        params: t.Object({ sceneId: t.Numeric() }),
        body: t.Object({
            variables: t.Optional(t.Record(t.String(), t.String())),
        }),
    })

    .patch(
        '/:id',
        async ({ params, body }) => {
            const updated = await variationService.update(params.id, body.variables)
            if (!updated) throw status(404, 'Variation not found')
            return updated
        },
        {
            params: t.Object({ sceneId: t.Numeric(), id: t.Numeric() }),
            body: t.Object({ variables: t.Record(t.String(), t.String()) }),
        },
    )

    .patch(
        '/:id/order',
        async ({ params, body }) => {
            const updated = await variationService.reorder(params.id, body.prevId, body.nextId)
            if (!updated) throw status(404, 'Variation not found')
            return updated
        },
        {
            params: t.Object({ sceneId: t.Numeric(), id: t.Numeric() }),
            body: t.Object({
                prevId: t.Nullable(t.Number()),
                nextId: t.Nullable(t.Number()),
            }),
        },
    )

    .delete(
        '/:id',
        async ({ params }) => {
            const deleted = await variationService.remove(params.id)
            if (!deleted) throw status(404, 'Variation not found')
            return { success: true }
        },
        { params: t.Object({ sceneId: t.Numeric(), id: t.Numeric() }) },
    )
