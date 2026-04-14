import Elysia from 'elysia'
import { IdParams, ImageModel } from './model'
import * as imageService from './service'

export const image = new Elysia({ prefix: '/images' })
    .get(
        '/',
        async ({ query, status }) => {
            const images = await imageService.getAllBySceneId(query.sceneId)

            if (images === null) {
                return status(404, 'Scene not found')
            }

            return images
        },
        {
            query: ImageModel.getParams,
        },
    )
    .patch(
        '/:id/order',
        async ({ params, body, status }) => {
            const result = await imageService.reorder(params.id, body.prevId, body.nextId)
            if (!result) return status(404, 'Image not found')
            return result
        },
        {
            params: IdParams,
            body: ImageModel.reorderBody,
        },
    )
    .delete(
        '/:id',
        async ({ params, status }) => {
            const result = await imageService.remove(params.id)

            if (!result) {
                return status(404, 'Image not found')
            }

            return status(204)
        },
        {
            params: IdParams,
        },
    )
