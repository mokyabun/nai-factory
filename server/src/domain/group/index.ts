import { GroupModel, IdParams } from '@nai-factory/shared'
import Elysia from 'elysia'
import * as projectService from '../project/service'
import * as groupService from './service'

export const groupController = new Elysia({ prefix: '/groups' })
    .get('/', () => groupService.getAll())
    .get(
        '/:id',
        async ({ params }) => {
            const group = await groupService.getById(params.id)
            if (!group) throw new Error('Group not found')

            const projects = await projectService.getAllByGroupId(params.id)

            return { ...group, projects }
        },
        {
            params: IdParams,
        },
    )
    .post(
        '/',
        async ({ body }) => {
            const group = await groupService.create(body)

            return group
        },
        { body: GroupModel.createBody },
    )
    .patch(
        '/:id',
        async ({ params, body }) => {
            const updated = await groupService.update(params.id, body)
            if (!updated) throw new Error('Group not found')

            return updated
        },
        { params: IdParams, body: GroupModel.updateBody },
    )
    .delete(
        '/:id',
        async ({ params, status }) => {
            const success = await groupService.remove(params.id)
            if (!success) throw new Error('Group not found')

            return status(204)
        },
        { params: IdParams },
    )
