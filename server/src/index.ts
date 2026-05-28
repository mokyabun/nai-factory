import { join } from 'node:path'
import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
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

const isProduction = Bun.env.NODE_ENV === 'production'
const webDistDir =
    process.env.WEB_DIST_DIR ?? (isProduction ? join(import.meta.dir, 'public') : '../web/dist')

function routeApi(app: Hono, prefix: string) {
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
        .get(`${prefix}/data/*`, serveStatic({ root: './' }))
}

function routeFrontend(app: Hono) {
    app.get('*', serveStatic({ root: webDistDir }))
    app.get('*', async (c) => {
        const pathname = new URL(c.req.url).pathname
        const filename = pathname.split('/').pop() ?? ''
        const acceptsHtml = c.req.header('accept')?.includes('text/html') ?? false

        if (filename.includes('.') && !acceptsHtml) {
            return c.json({ message: 'Not found' }, 404)
        }

        return c.html(await Bun.file(`${webDistDir}/index.html`).text())
    })
}

export function createApp(options: { production?: boolean } = {}) {
    const production = options.production ?? isProduction
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

    routeApi(app, production ? '/api' : '')

    if (production) {
        app.all('/api/*', (c) => c.json({ message: 'Not found' }, 404))
        routeFrontend(app)
    }

    return app
}

const port = Number(process.env.PORT ?? 3000)
const app = createApp()

logger.info({ port }, 'NAI Factory Hono server running')

export default {
    port,
    fetch: app.fetch,
}
