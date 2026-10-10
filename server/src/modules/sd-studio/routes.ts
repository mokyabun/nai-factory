import { contract } from '@nai-factory/shared'
import type { Hono } from 'hono'

import type { AppContext, AppEnv } from '@/context'
import { route } from '@/lib/http'

import * as service from './service'

export function registerSdStudioRoutes(app: Hono<AppEnv>, ctx: AppContext) {
    route(app, contract.sdStudio.import, ({ body }) =>
        service.importToProject(ctx, body.projectId, body.data, body.options),
    )
}
