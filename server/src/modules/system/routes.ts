import { contract } from '@nai-factory/shared'
import type { Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'

import { APP_VERSION } from '@/config'
import type { AppContext, AppEnv } from '@/context'
import { AppError, route } from '@/lib/http'
import { TOKEN_COOKIE, tokenMatches } from '@/modules/security/middleware'

export function registerSystemRoutes(app: Hono<AppEnv>, ctx: AppContext) {
    const api = contract.system
    route(app, api.health, () => ({ ok: true as const, version: APP_VERSION }))
    route(app, api.login, ({ body, c }) => {
        if (!tokenMatches(ctx.config, body.token)) {
            throw new AppError(401, 'unauthorized', 'Invalid access token')
        }
        setCookie(c, TOKEN_COOKIE, body.token, {
            httpOnly: true,
            sameSite: 'Strict',
            path: '/',
            secure: c.req.url.startsWith('https:'),
            maxAge: 60 * 60 * 24 * 365,
        })
        return { ok: true as const }
    })
    route(app, api.logout, ({ c }) => {
        deleteCookie(c, TOKEN_COOKIE, { path: '/' })
        return { ok: true as const }
    })
}
