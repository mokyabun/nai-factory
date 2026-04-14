import { eq } from 'drizzle-orm'
import { Elysia, status } from 'elysia'
import { db } from '@/db'
import { projects, scenes } from '@/db/schema'
import { compilePrompts, compileVariables } from '@/services/prompt'
import * as settingsService from '@/services/settings'
import { SceneModel } from './model'
import * as service from './service'

export const scene = new Elysia({ prefix: '/scenes' })
    .get('/', ({ query }) => service.get(query.projectId), {
        query: SceneModel.listQuery,
    })
    .get('/:id', ({ params }) => service.getById(params.id), {
        params: SceneModel.getParams,
    })
    .get(
        '/:id/workspace',
        async ({ params }) => {
            const [s] = await db
                .select({ projectId: scenes.projectId })
                .from(scenes)
                .where(eq(scenes.id, params.id))
            if (!s) throw status(404, 'Scene not found')
            return service.getWorkspaceData(s.projectId)
        },
        { params: SceneModel.getParams },
    )
    .get(
        '/:id/preview-prompt',
        async ({ params, query }) => {
            const [s] = await db.select().from(scenes).where(eq(scenes.id, params.id))
            if (!s) throw status(404, 'Scene not found')

            const [proj] = await db.select().from(projects).where(eq(projects.id, s.projectId))
            if (!proj) throw status(404, 'Project not found')

            const globalSettings = settingsService.get()

            let variationList = s.variations
            if (query.variationId !== undefined) {
                const single = variationList[query.variationId]
                if (!single) throw status(404, 'Variation not found')
                variationList = [single]
            }

            const compiledVars = compileVariables(
                globalSettings.globalVariables,
                proj.variables,
                variationList,
            )

            return compilePrompts(
                {
                    prompt: proj.prompt,
                    negativePrompt: proj.negativePrompt,
                    characterPrompts: proj.characterPrompts,
                },
                compiledVars,
            )
        },
        { params: SceneModel.getParams, query: SceneModel.previewQuery },
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
