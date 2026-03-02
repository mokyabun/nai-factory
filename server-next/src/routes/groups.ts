import { Elysia, status, t } from 'elysia'
import * as groupService from '@/services/group'
import * as projectService from '@/services/project'

export const groupRoutes = new Elysia({ prefix: '/groups' })
    .get('/', () => groupService.listGroups())

    .get(
        '/:id',
        async ({ params }) => {
            const group = await groupService.getGroupById(params.id)
            if (!group) throw status(404, 'Group not found')

            // Also load projects for this group
            const projects = await projectService.listProjects(params.id)
            return { ...group, projects }
        },
        { params: t.Object({ id: t.Numeric() }) },
    )

    .post('/', ({ body }) => groupService.createGroup(body.name), {
        body: t.Object({ name: t.String({ minLength: 1 }) }),
    })

    .patch(
        '/:id',
        async ({ params, body }) => {
            const updated = await groupService.updateGroup(params.id, body)
            if (!updated) throw status(404, 'Group not found')
            return updated
        },
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Object({ name: t.Optional(t.String({ minLength: 1 })) }),
        },
    )

    .delete(
        '/:id',
        async ({ params }) => {
            const deleted = await groupService.deleteGroup(params.id)
            if (!deleted) throw status(404, 'Group not found')
            return status(204)
        },
        { params: t.Object({ id: t.Numeric() }) },
    )
