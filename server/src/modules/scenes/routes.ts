import { contract } from '@nai-factory/shared'
import type { Hono } from 'hono'

import type { AppContext, AppEnv } from '@/context'
import { route } from '@/lib/http'

import * as service from './service'

export function registerSceneRoutes(app: Hono<AppEnv>, ctx: AppContext) {
    const api = contract.scenes
    route(app, api.list, ({ query }) => service.list(ctx, query.projectId))
    route(app, api.get, ({ params }) => service.get(ctx, params.id))
    route(app, api.summary, ({ params }) => service.summary(ctx, params.id))
    route(app, api.preview, ({ params, query }) =>
        service.preview(ctx, params.id, query.variationId),
    )
    route(app, api.create, ({ body }) => service.create(ctx, body))
    route(app, api.update, ({ params, body }) => service.update(ctx, params.id, body))
    route(app, api.move, ({ params, body }) => service.move(ctx, params.id, body))
    route(app, api.delete, ({ params }) => service.remove(ctx, params.id))
    route(app, api.duplicate, ({ params }) => service.duplicate(ctx, params.id))
    route(app, api.exportJson, ({ body }) => service.exportJson(ctx, body))
    route(app, api.importJson, ({ body }) =>
        service.importJson(ctx, body.projectId, body.data, body.mode),
    )
}
