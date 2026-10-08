import { contract } from '@nai-factory/shared'
import type { Hono } from 'hono'

import type { AppEnv } from '@/context'
import { route } from '@/lib/http'

import * as service from './service'

export function registerTagRoutes(app: Hono<AppEnv>) {
    route(app, contract.tags.autocomplete, ({ query }) => service.search(query.q, query.limit))
}
