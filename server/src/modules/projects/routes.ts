import { contract } from '@nai-factory/shared'
import type { Hono } from 'hono'

import type { AppContext, AppEnv } from '@/context'
import { route } from '@/lib/http'

import * as service from './service'

export function registerProjectRoutes(app: Hono<AppEnv>, ctx: AppContext) {
    const api = contract.projects
    route(app, api.list, ({ query }) => service.list(ctx, query.groupId))
    route(app, api.get, ({ params }) => service.get(ctx, params.id))
    route(app, api.create, ({ body }) => service.create(ctx, body))
    route(app, api.update, ({ params, body }) => service.update(ctx, params.id, body))
    route(app, api.delete, ({ params }) => service.remove(ctx, params.id))
    route(app, api.duplicate, ({ params, body }) => service.duplicate(ctx, params.id, body))
}
