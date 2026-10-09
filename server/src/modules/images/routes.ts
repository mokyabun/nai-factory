import { contract } from '@nai-factory/shared'
import type { Hono } from 'hono'

import type { AppContext, AppEnv } from '@/context'
import { route } from '@/lib/http'

import * as service from './service'

export function registerImageRoutes(app: Hono<AppEnv>, ctx: AppContext) {
    const api = contract.images
    route(app, api.list, ({ query }) => service.list(ctx, query.sceneId, query.variationId))
    route(app, api.move, ({ params, body }) => service.move(ctx, params.id, body))
    route(app, api.delete, ({ params }) => service.remove(ctx, params.id))
    route(app, api.deleteMany, ({ body }) => service.removeMany(ctx, body.ids))
}
