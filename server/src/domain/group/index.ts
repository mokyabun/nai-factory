import Elysia, { status } from 'elysia'
import * as projectService from '../project/service'
import { GroupModel, IdParams } from './model'
import * as groupService from './service'

export const group = new Elysia({ prefix: '/groups' })
    .get('/', () => groupService.getAll())
    .get(
        '/:id',
        async ({ params }) => {
            const grp = await groupService.getById(params.id)
            if (!grp) throw status(404, 'Group not found')

            const projects = await projectService.getAllByGroupId(params.id)

            return { ...grp, projects }
        },
        {
            params: IdParams,
        },
    )
    .post('/', ({ body }) => groupService.create(body), { body: GroupModel.createBody })
    .patch(
        '/:id',
        async ({ params, body }) => {
            const updated = await groupService.update(params.id, body)
            if (!updated) throw status(404, 'Group not found')
            return updated
        },
        { params: IdParams, body: GroupModel.updateBody },
    )
    .delete(
        '/:id',
        async ({ params }) => {
            const success = await groupService.remove(params.id)
            if (!success) throw status(404, 'Group not found')
            return status(204)
        },
        { params: IdParams },
    )
