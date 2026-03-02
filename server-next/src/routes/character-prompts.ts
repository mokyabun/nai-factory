import { Elysia, status, t } from 'elysia'
import * as charPromptService from '@/services/character-prompt'

export const characterPromptRoutes = new Elysia({
    prefix: '/projects/:projectId/character-prompts',
})
    .get('/', ({ params }) => charPromptService.listByProject(params.projectId), {
        params: t.Object({ projectId: t.Numeric() }),
    })

    .post('/', ({ params, body }) => charPromptService.create(params.projectId, body), {
        params: t.Object({ projectId: t.Numeric() }),
        body: t.Object({
            enabled: t.Optional(t.Boolean()),
            centerX: t.Optional(t.Number()),
            centerY: t.Optional(t.Number()),
            prompt: t.Optional(t.String()),
            uc: t.Optional(t.String()),
        }),
    })

    .patch(
        '/:id',
        async ({ params, body }) => {
            const updated = await charPromptService.update(params.id, body)
            if (!updated) throw status(404, 'Character prompt not found')
            return updated
        },
        {
            params: t.Object({ projectId: t.Numeric(), id: t.Numeric() }),
            body: t.Object({
                enabled: t.Optional(t.Boolean()),
                centerX: t.Optional(t.Number()),
                centerY: t.Optional(t.Number()),
                prompt: t.Optional(t.String()),
                uc: t.Optional(t.String()),
            }),
        },
    )

    .patch(
        '/:id/order',
        async ({ params, body }) => {
            const updated = await charPromptService.reorder(params.id, body.prevId, body.nextId)
            if (!updated) throw status(404, 'Character prompt not found')
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
            const deleted = await charPromptService.remove(params.id)
            if (!deleted) throw status(404, 'Character prompt not found')
            return { success: true }
        },
        { params: t.Object({ projectId: t.Numeric(), id: t.Numeric() }) },
    )
