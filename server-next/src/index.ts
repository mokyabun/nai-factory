import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import {
    characterReference,
    group,
    image,
    project,
    queue,
    scene,
    sdStudio,
    setting,
    sse,
    tag,
    vibeTransfer,
} from './domains'
import logger from './logger'

export function createApp() {
    const app = new Hono()

    app.use('*', cors())
    app.onError((error, c) => {
        if (error instanceof HTTPException) {
            return c.json({ message: error.message }, error.status)
        }

        logger.error({ err: error }, 'Unhandled error')
        return c.json(
            { message: error instanceof Error ? error.message : 'Internal server error' },
            500,
        )
    })
    app.notFound((c) => c.json({ message: 'Not found' }, 404))

    return app
        .route('/groups', group)
        .route('/projects', project)
        .route('/projects/:projectId/character-references', characterReference)
        .route('/projects/:projectId/vibe-transfers', vibeTransfer)
        .route('/scenes', scene)
        .route('/images', image)
        .route('/queue', queue)
        .route('/sd-studio', sdStudio)
        .route('/settings', setting)
        .route('/', sse)
        .route('/tags', tag)
        .get('/data/*', serveStatic({ root: './' }))
}

const port = Number(process.env.PORT ?? 3000)
const app = createApp()

logger.info({ port }, 'NAI Factory Hono server running')

export default {
    port,
    fetch: app.fetch,
}
