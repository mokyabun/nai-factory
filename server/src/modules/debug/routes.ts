import { contract } from '@nai-factory/shared'
import type { Hono } from 'hono'

import type { AppContext, AppEnv } from '@/context'
import { route } from '@/lib/http'
import * as assets from '@/modules/assets/service'

export function registerDebugRoutes(app: Hono<AppEnv>, ctx: AppContext) {
    const api = contract.debug
    route(app, api.requests, () => ctx.debugLog.list())
    route(app, api.clearRequests, () => ctx.debugLog.clear())
    route(app, api.gc, ({ query }) =>
        assets.collectGarbage(ctx, { dryRun: !(query.apply ?? false) }),
    )
}
