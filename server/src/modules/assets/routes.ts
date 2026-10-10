import type { Hono } from 'hono'

import type { AppContext, AppEnv } from '@/context'

import * as service from './service'

export function registerAssetRoutes(app: Hono<AppEnv>, ctx: AppContext) {
    app.get('/api/assets/:id', (c) =>
        service.serve(ctx, c.req.param('id'), c.req.header('if-none-match')),
    )
}
