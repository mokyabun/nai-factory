import { cors } from '@elysiajs/cors'
import { Elysia } from 'elysia'
import {
    group,
    image,
    project,
    queue,
    scene,
    sdStudio,
    setting,
    sse,
    vibeTransfer,
} from './domain'
import logger from './logger'

export function createApp() {
    return new Elysia()
        .use(cors())
        .onError(({ code, error, set }) => {
            if (code === 'VALIDATION') {
                set.status = 422
                return { message: 'Validation error', details: error.message }
            }

            if (code === 'NOT_FOUND') {
                set.status = 404
                return { message: 'Not found' }
            }

            logger.error({ err: error }, 'Unhandled error')
            set.status = 500
            return {
                message: error instanceof Error ? error.message : 'Internal server error',
            }
        })
        .use(group)
        .use(project)
        .use(vibeTransfer)
        .use(scene)
        .use(image)
        .use(queue)
        .use(sdStudio)
        .use(setting)
        .use(sse)
        .get('/data/*', ({ params }) => Bun.file(`./data/${params['*']}`))
}
