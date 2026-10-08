import { randomUUID } from 'node:crypto'
import { join } from 'node:path'

import { API_PREFIX } from '@nai-factory/shared'
import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'

import type { AppContext, AppEnv } from './context'
import { AppError, errorBody } from './lib/http'
import { registerArchiveRoutes } from './modules/archive/routes'
import { registerAssetRoutes } from './modules/assets/routes'
import { registerDebugRoutes } from './modules/debug/routes'
import { registerGroupRoutes } from './modules/groups/routes'
import { registerImageRoutes } from './modules/images/routes'
import { registerJobRoutes } from './modules/jobs/routes'
import { registerPlaygroundRoutes } from './modules/playground/routes'
import { registerProjectRoutes } from './modules/projects/routes'
import { registerRealtimeRoutes } from './modules/realtime/routes'
import { registerReferenceRoutes } from './modules/references/routes'
import { registerSceneRoutes } from './modules/scenes/routes'
import { registerSdStudioRoutes } from './modules/sd-studio/routes'
import { securityMiddleware } from './modules/security/middleware'
import { registerSettingsRoutes } from './modules/settings/routes'
import { registerStashRoutes } from './modules/stash/routes'
import { registerSystemRoutes } from './modules/system/routes'
import { registerTagRoutes } from './modules/tags/routes'

function createApi(ctx: AppContext) {
    const api = new Hono<AppEnv>()
    registerSystemRoutes(api, ctx)
    registerGroupRoutes(api, ctx)
    registerProjectRoutes(api, ctx)
    registerArchiveRoutes(api, ctx)
    registerReferenceRoutes(api, ctx)
    registerSceneRoutes(api, ctx)
    registerImageRoutes(api, ctx)
    registerJobRoutes(api, ctx)
    registerPlaygroundRoutes(api, ctx)
    registerSettingsRoutes(api, ctx)
    registerStashRoutes(api, ctx)
    registerSdStudioRoutes(api, ctx)
    registerTagRoutes(api)
    registerDebugRoutes(api, ctx)
    return api
}

function registerFrontend(app: Hono<AppEnv>, webDistDir: string) {
    app.get('*', serveStatic({ root: webDistDir }))
    app.get('*', async (c) => {
        const filename = c.req.path.split('/').pop() ?? ''
        const acceptsHtml = c.req.header('accept')?.includes('text/html') ?? false
        if (filename.includes('.') && !acceptsHtml) return c.notFound()
        return c.html(await Bun.file(join(webDistDir, 'index.html')).text())
    })
}

export function createApp(ctx: AppContext) {
    const app = new Hono<AppEnv>()
    const production = ctx.config.env === 'production'

    app.use('*', async (c, next) => {
        const requestId = c.req.header('x-request-id')?.slice(0, 100) || randomUUID()
        c.set('requestId', requestId)
        c.set('validateResponses', !production)
        c.header('x-request-id', requestId)
        await next()
    })

    // Production serves the web app from the same origin, so no CORS headers at all.
    if (!production) {
        app.use(`${API_PREFIX}/*`, cors({ origin: ctx.config.devWebOrigin, credentials: true }))
    }
    app.use('*', securityMiddleware(ctx.config))

    app.onError((error, c) => {
        const requestId = c.get('requestId')
        if (error instanceof AppError) {
            if (error.status >= 500) {
                ctx.log.error({ requestId, err: error, details: error.details }, error.message)
            }
            return c.json(errorBody(error, requestId), error.status)
        }
        if (error instanceof HTTPException) {
            return c.json(
                errorBody(new AppError(error.status, 'bad_request', error.message), requestId),
                error.status,
            )
        }
        ctx.log.error(
            {
                event: 'request.unhandled_error',
                requestId,
                method: c.req.method,
                path: c.req.path,
                err: error,
            },
            'Unhandled error',
        )
        return c.json(
            errorBody(new AppError(500, 'internal', 'Internal server error'), requestId),
            500,
        )
    })
    app.notFound((c) =>
        c.json(errorBody(new AppError(404, 'not_found', 'Not found'), c.get('requestId')), 404),
    )

    app.get('/healthz', (c) => c.json({ ok: true }))
    registerAssetRoutes(app, ctx)
    registerRealtimeRoutes(app, ctx)
    app.route(API_PREFIX, createApi(ctx))

    if (production) {
        app.all(`${API_PREFIX}/*`, (c) => c.notFound())
        registerFrontend(app, ctx.config.webDistDir)
    }

    return app
}
