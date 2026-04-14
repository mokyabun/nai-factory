import { Elysia } from 'elysia'
import { SdStudioModel } from './model'
import * as service from './service'

export const sdStudio = new Elysia({ prefix: '/sd-studio' })
    .post('/import', ({ body }) => service.importToProject(body.projectId, body.data), {
        body: SdStudioModel.importBody,
    })
