import { Elysia, status } from 'elysia'
import { VibeTransferModel } from './model'
import * as service from './service'

export const vibeTransfer = new Elysia({ prefix: '/projects/:projectId/vibe-transfers' })
    .get('/', ({ params }) => service.list(params.projectId), {
        params: VibeTransferModel.projectParams,
    })
    .post('/upload', ({ params, body }) => service.upload(params.projectId, body.image), {
        params: VibeTransferModel.projectParams,
        body: VibeTransferModel.uploadBody,
    })
    .patch('/reorder', ({ body }) => service.reorder(body.id, body.prevId, body.nextId), {
        body: VibeTransferModel.reorderBody,
    })
    .patch(
        '/:id',
        async ({ params, body }) => {
            const result = await service.update(params.id, body)
            if (!result) throw status(404, 'Vibe transfer not found')
            return result
        },
        {
            params: VibeTransferModel.itemParams,
            body: VibeTransferModel.updateBody,
        },
    )
    .delete(
        '/:id',
        async ({ params }) => {
            const success = await service.remove(params.id)
            if (!success) throw status(404, 'Vibe transfer not found')
            return status(204)
        },
        {
            params: VibeTransferModel.itemParams,
        },
    )
