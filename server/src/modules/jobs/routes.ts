import { contract } from '@nai-factory/shared'
import type { Hono } from 'hono'

import type { AppContext, AppEnv } from '@/context'
import { route } from '@/lib/http'

import * as service from './service'

export function registerJobRoutes(app: Hono<AppEnv>, ctx: AppContext) {
    const api = contract.jobs
    route(app, api.list, ({ query }) => service.list(ctx, query.status, query.projectId))
    route(app, api.history, ({ query }) => service.history(ctx, query.limit))
    route(app, api.status, () => service.status(ctx))
    route(app, api.enqueueScenes, ({ body }) => service.enqueueScenes(ctx, body))
    route(app, api.enqueuePlayground, ({ body }) => service.enqueuePlayground(ctx, body))
    route(app, api.start, () => {
        ctx.scheduler.start()
        return service.status(ctx)
    })
    route(app, api.stop, () => {
        ctx.scheduler.stop()
        return service.status(ctx)
    })
    route(app, api.move, ({ params, body }) => service.move(ctx, params.id, body))
    route(app, api.retry, ({ params }) => service.retry(ctx, params.id))
    route(app, api.delete, ({ params }) => service.remove(ctx, params.id))
    route(app, api.clear, ({ query }) => service.clear(ctx, query))
}
