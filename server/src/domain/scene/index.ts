import { Elysia } from 'elysia'
import { SceneModel } from './model'
import * as service from './service'

export const scene = new Elysia({ prefix: '/scenes' })
    .get('/', ({ query }) => service.get(query.projectId), {
        query: SceneModel.listQuery,
    })
    .get('/:id', ({ params }) => service.getById(params.id), {
        params: SceneModel.getParams,
    })
    .get('/:id/summary', ({ params }) => service.getSummary(params.id), {
        params: SceneModel.getParams,
    })
    .get('/:id/workspace', ({ params }) => service.getWorkspaceData(params.id), {
        params: SceneModel.getParams,
    })
    .get(
        '/:id/preview-prompt',
        ({ params, query }) => service.getPreviewPrompts(params.id, query.variationId),
        {
            params: SceneModel.getParams,
            query: SceneModel.previewQuery,
        },
    )
    .post('/', ({ body }) => service.create(body.projectId, body.name), {
        body: SceneModel.createBody,
    })
    .patch('/:id', ({ params, body }) => service.update(params.id, body), {
        params: SceneModel.updateParams,
        body: SceneModel.updateBody,
    })
    .patch(
        '/:id/order',
        ({ params, body }) => service.reorder(params.id, body.prevId, body.nextId),
        {
            params: SceneModel.updateParams,
            body: SceneModel.reorderBody,
        },
    )
    .delete('/:id', ({ params }) => service.remove(params.id), { params: SceneModel.getParams })
    .post('/:id/duplicate', ({ params }) => service.duplicate(params.id), {
        params: SceneModel.getParams,
    })
