import { contract } from '@nai-factory/shared'
import type { Hono } from 'hono'

import type { AppContext, AppEnv } from '@/context'
import { route } from '@/lib/http'

import * as service from './service'

export function registerPlaygroundRoutes(app: Hono<AppEnv>, ctx: AppContext) {
    const api = contract.playground
    route(app, api.state, () => service.getState(ctx))
    route(app, api.updateState, ({ body }) => service.updateState(ctx, body))
    route(app, api.images, ({ query }) => service.listImages(ctx, query.limit))
    route(app, api.deleteImage, ({ params }) => service.removeImage(ctx, params.id))
}
