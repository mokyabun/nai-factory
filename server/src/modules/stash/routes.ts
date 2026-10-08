import { contract } from '@nai-factory/shared'
import type { Hono } from 'hono'

import type { AppContext, AppEnv } from '@/context'
import { route } from '@/lib/http'

import * as service from './service'

export function registerStashRoutes(app: Hono<AppEnv>, ctx: AppContext) {
    const api = contract.stash
    route(app, api.list, ({ query }) => service.list(ctx, query.type))
    route(app, api.get, ({ params }) => service.get(ctx, params.id))
    route(app, api.create, ({ body }) => service.create(ctx, body))
    route(app, api.update, ({ params, body }) => service.update(ctx, params.id, body))
    route(app, api.delete, ({ params }) => service.remove(ctx, params.id))
    route(app, api.apply, ({ params, body }) => service.apply(ctx, params.id, body))
    route(app, api.captureScenes, ({ body }) => service.captureScenes(ctx, body))
}
