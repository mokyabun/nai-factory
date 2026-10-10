import { timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'

import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'

import type { AppConfig } from '@/config'
import type { AppEnv } from '@/context'
import { AppError, errorBody } from '@/lib/http'

export const TOKEN_COOKIE = 'naif_token'
const LOOPBACK_NAMES = new Set(['localhost', '127.0.0.1', '::1'])
const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Hostname of a `Host` header value (`[::1]:3000` → `::1`, `localhost:5173` → `localhost`). */
export function hostnameOf(host: string) {
    const trimmed = host.trim().toLowerCase()
    if (trimmed.startsWith('[')) return trimmed.slice(1, trimmed.indexOf(']'))
    const colon = trimmed.lastIndexOf(':')
    return colon === -1 ? trimmed : trimmed.slice(0, colon)
}

export function isLoopback(host: string) {
    const name = hostnameOf(host)
    return LOOPBACK_NAMES.has(name) || name.startsWith('127.')
}

/** IP literals allow LAN access; unknown domain names are refused to block DNS rebinding. */
export function isAllowedHost(host: string | undefined, allowed: string[]) {
    if (!host) return false
    const name = hostnameOf(host)
    if (LOOPBACK_NAMES.has(name) || isIP(name) !== 0) return true
    return allowed.some((entry) => entry.toLowerCase() === name)
}

/** Whether a state-changing request comes from this app's own origin (CSRF protection). */
export function isSameOrigin(input: {
    origin: string | undefined
    host: string | undefined
    fetchSite: string | undefined
    extraOrigins: string[]
}) {
    if (input.fetchSite === 'cross-site') return false
    if (!input.origin) return true
    if (input.extraOrigins.includes(input.origin)) return true
    try {
        return new URL(input.origin).host.toLowerCase() === input.host?.trim().toLowerCase()
    } catch {
        return false
    }
}

function safeEqual(a: string, b: string) {
    const left = Buffer.from(a)
    const right = Buffer.from(b)
    return left.byteLength === right.byteLength && timingSafeEqual(left, right)
}

export function tokenMatches(
    config: Pick<AppConfig, 'accessToken'>,
    candidate: string | undefined,
) {
    return !!config.accessToken && !!candidate && safeEqual(config.accessToken, candidate)
}

function reject(error: AppError) {
    return new Response(JSON.stringify(errorBody(error)), {
        status: error.status,
        headers: { 'Content-Type': 'application/json' },
    })
}

export function securityMiddleware(config: AppConfig): MiddlewareHandler<AppEnv> {
    const extraOrigins = config.env === 'production' ? [] : [config.devWebOrigin]
    const publicPaths = new Set(['/healthz', '/api/healthz', '/api/auth/login'])

    return async (c, next) => {
        const host = c.req.header('host') ?? new URL(c.req.url).host
        if (!isAllowedHost(host, config.allowedHosts)) {
            return reject(new AppError(403, 'forbidden', 'Host not allowed'))
        }

        if (
            STATE_CHANGING.has(c.req.method) &&
            !isSameOrigin({
                origin: c.req.header('origin'),
                host,
                fetchSite: c.req.header('sec-fetch-site'),
                extraOrigins,
            })
        ) {
            return reject(new AppError(403, 'forbidden', 'Cross-origin request refused'))
        }

        const path = c.req.path
        if (config.accessToken && path.startsWith('/api/') && !publicPaths.has(path)) {
            const header = c.req.header('authorization')
            const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined
            if (
                !tokenMatches(config, bearer) &&
                !tokenMatches(config, getCookie(c, TOKEN_COOKIE))
            ) {
                return reject(new AppError(401, 'unauthorized', 'Access token required'))
            }
        }

        await next()
    }
}
