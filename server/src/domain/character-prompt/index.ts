import { Elysia } from 'elysia'
import { CharacterPromptModel } from './model'
import * as service from './service'

export const characterPrompt = new Elysia({ prefix: '/projects/:projectId/character-prompts' })
    .get('/', ({ params }) => service.list(params.projectId), {
        params: CharacterPromptModel.projectParams,
    })
    .post('/', ({ params, body }) => service.create(params.projectId, body), {
        params: CharacterPromptModel.projectParams,
        body: CharacterPromptModel.createBody,
    })
    .patch('/:index', ({ params, body }) => service.update(params.projectId, params.index, body), {
        params: CharacterPromptModel.itemParams,
        body: CharacterPromptModel.updateBody,
    })
    .delete('/:index', ({ params }) => service.remove(params.projectId, params.index), {
        params: CharacterPromptModel.itemParams,
    })
