import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { envConfig } from './config'
import * as dataStorage from './data'
import {
    characterReference,
    debug,
    group,
    image,
    playground,
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

type AppEnv = {
    Variables: {
        requestId: string
    }
}

function routeApi(app: Hono<AppEnv>, prefix: string) {
    return app
        .route(`${prefix}/groups`, group)
        .route(`${prefix}/projects`, project)
        .route(`${prefix}/projects/:projectId/character-references`, characterReference)
        .route(`${prefix}/projects/:projectId/vibe-transfers`, vibeTransfer)
        .route(`${prefix}/scenes`, scene)
        .route(`${prefix}/images`, image)
        .route(`${prefix}/playground`, playground)
        .route(`${prefix}/debug`, debug)
        .route(`${prefix}/queue`, queue)
        .route(`${prefix}/sd-studio`, sdStudio)
        .route(`${prefix}/settings`, setting)
        .route(prefix || '/', sse)
        .route(`${prefix}/tags`, tag)
        .get(`${prefix}/data/*`, async (c) => {
            const pathname = new URL(c.req.url).pathname
            const relativePath = decodeURIComponent(
                prefix ? pathname.slice(prefix.length + 1) : pathname.slice(1),
            )
            return dataStorage.serveFile(relativePath)
        })
}

function routeFrontend(app: Hono<AppEnv>) {
    app.get('*', serveStatic({ root: envConfig.WEB_DIST_DIR }))
    app.get('*', async (c) => {
        const pathname = new URL(c.req.url).pathname
        const filename = pathname.split('/').pop() ?? ''
        const acceptsHtml = c.req.header('accept')?.includes('text/html') ?? false

        if (filename.includes('.') && !acceptsHtml) {
            return c.json({ message: 'Not found' }, 404)
        }

        return c.html(await Bun.file(join(envConfig.WEB_DIST_DIR, 'index.html')).text())
    })
}

export function createApp(options: { production?: boolean } = {}) {
    const production = options.production ?? envConfig.NODE_ENV === 'production'
    const app = new Hono<AppEnv>()

    app.use('*', async (c, next) => {
        const requestId = c.req.header('x-request-id') ?? randomUUID()
        c.set('requestId', requestId)
        c.header('x-request-id', requestId)

        await next()
    })
    app.use('*', cors())
    app.onError((error, c) => {
        const requestId = c.get('requestId')
        const path = new URL(c.req.url).pathname

        if (error instanceof HTTPException) {
            return c.json({ message: error.message }, error.status)
        }

        logger.error({ requestId, method: c.req.method, path, err: error }, 'Unhandled error')
        return c.json(
            { message: error instanceof Error ? error.message : 'Internal server error' },
            500,
        )
    })
    app.notFound((c) => c.json({ message: 'Not found' }, 404))

    routeApi(app, production ? '/api' : '')

    if (production) {
        app.all('/api/*', (c) => c.json({ message: 'Not found' }, 404))
        routeFrontend(app)
    }

    return app
}

const port = envConfig.PORT
const app = createApp()

logger.info({ port }, 'NAI Factory Hono server running')

export default {
    port,
    fetch: app.fetch,
}
