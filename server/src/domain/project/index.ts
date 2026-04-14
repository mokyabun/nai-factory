import { Elysia, status, t } from 'elysia'
import { IdParams, ProjectModel } from './model'
import * as projectService from './service'

export const project = new Elysia({ prefix: '/projects' })
    .get(
        '/',
        async ({ query }) => {
            if (query.groupId === undefined) throw status(400, 'groupId is required')
            return projectService.getAllByGroupId(query.groupId)
        },
        { query: t.Object({ groupId: t.Optional(t.Numeric()) }) },
    )
    .get(
        '/:projectId',
        async ({ params }) => {
            const proj = await projectService.getById(params.projectId)
            if (!proj) throw status(404, 'Project not found')
            return proj
        },
        { params: IdParams },
    )
    .post(
        '/',
        async ({ body }) => {
            const proj = await projectService.create(body)
            if (!proj) throw status(500, 'Failed to create project')
            return proj
        },
        { body: ProjectModel.createBody },
    )
    .patch(
        '/:projectId',
        async ({ params, body }) => {
            const updated = await projectService.update(params.projectId, body)
            if (!updated) throw status(404, 'Project not found')
            return updated
        },
        { params: IdParams, body: ProjectModel.updateBody },
    )
    .delete(
        '/:projectId',
        async ({ params }) => {
            const success = await projectService.remove(params.projectId)
            if (!success) throw status(404, 'Project not found')
            return status(204)
        },
        { params: IdParams },
    )
    .post(
        '/:projectId/duplicate',
        async ({ params }) => {
            const proj = await projectService.duplicate(params.projectId)
            if (!proj) throw status(404, 'Project not found')
            return proj
        },
        { params: IdParams },
    )
