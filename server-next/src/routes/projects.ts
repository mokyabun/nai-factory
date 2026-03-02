import { Elysia, status, t } from 'elysia'
import * as projectService from '@/services/project'

const ParametersSchema = t.Partial(
    t.Object({
        width: t.Number(),
        height: t.Number(),
        steps: t.Number(),
        promptGuidance: t.Number(),
        varietyPlus: t.Boolean(),
        seed: t.Number(),
        sampler: t.Union([
            t.Literal('k_euler_ancestral'),
            t.Literal('k_euler'),
            t.Literal('k_dpmpp_2s_ancestral'),
            t.Literal('k_dpmpp_2m'),
            t.Literal('k_dpmpp_sde'),
            t.Literal('k_dpmpp_2m_sde'),
            t.Literal('dimm_v3'),
        ]),
        promptGuidanceRescale: t.Number(),
        noiseSchedule: t.Union([
            t.Literal('native'),
            t.Literal('karras'),
            t.Literal('exponential'),
            t.Literal('polyexponential'),
        ]),
        normalizeReferenceStrengthValues: t.Boolean(),
        useCharacterPositions: t.Boolean(),
    }),
)

export const projectRoutes = new Elysia({ prefix: '/projects' })
    .get('/', ({ query }) => projectService.listProjects(query.groupId), {
        query: t.Object({ groupId: t.Optional(t.Numeric()) }),
    })

    .get(
        '/:projectId',
        async ({ params }) => {
            const project = await projectService.getProjectById(params.projectId)
            if (!project) throw status(404, 'Project not found')
            return project
        },
        { params: t.Object({ projectId: t.Numeric() }) },
    )

    .get(
        '/:projectId/workspace',
        async ({ params }) => {
            const data = await projectService.getWorkspaceData(params.projectId)
            if (!data) throw status(404, 'Project not found')
            return data
        },
        { params: t.Object({ projectId: t.Numeric() }) },
    )

    .post(
        '/',
        async ({ body }) => {
            const created = await projectService.createProject(body.groupId, body.name)
            if (!created) throw status(404, 'Group not found')
            return created
        },
        {
            body: t.Object({ groupId: t.Number(), name: t.String({ minLength: 1 }) }),
        },
    )

    .patch(
        '/:projectId',
        async ({ params, body }) => {
            const updated = await projectService.updateProject(params.projectId, body)
            if (!updated) throw status(404, 'Project not found')
            return updated
        },
        {
            params: t.Object({ projectId: t.Numeric() }),
            body: t.Object({
                name: t.Optional(t.String({ minLength: 1 })),
                prompt: t.Optional(t.String()),
                negativePrompt: t.Optional(t.String()),
                parameters: t.Optional(ParametersSchema),
                variables: t.Optional(t.Record(t.String(), t.String())),
            }),
        },
    )

    .patch(
        '/:projectId/order',
        async ({ params, body }) => {
            const updated = await projectService.reorderProject(
                params.projectId,
                body.prevId,
                body.nextId,
            )
            if (!updated) throw status(404, 'Project not found')
            return updated
        },
        {
            params: t.Object({ projectId: t.Numeric() }),
            body: t.Object({
                prevId: t.Nullable(t.Number()),
                nextId: t.Nullable(t.Number()),
            }),
        },
    )

    .delete(
        '/:projectId',
        async ({ params }) => {
            const deleted = await projectService.deleteProject(params.projectId)
            if (!deleted) throw status(404, 'Project not found')
            return { success: true }
        },
        { params: t.Object({ projectId: t.Numeric() }) },
    )
