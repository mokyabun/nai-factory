import type {
    EndpointDef,
    EndpointParams,
    EndpointParsedBody,
    EndpointQuery,
    EndpointResponse,
} from '@nai-factory/shared'
import type { Context, Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type * as z from 'zod'

import type { AppEnv } from '@/context'

export type ErrorCode =
    | 'bad_request'
    | 'validation_error'
    | 'unauthorized'
    | 'forbidden'
    | 'not_found'
    | 'conflict'
    | 'payload_too_large'
    | 'unsupported_media_type'
    | 'upstream_error'
    | 'internal'

export class AppError extends Error {
    constructor(
        readonly status: ContentfulStatusCode,
        readonly code: ErrorCode,
        message: string,
        readonly details?: unknown,
    ) {
        super(message)
        this.name = 'AppError'
    }
}

export const badRequest = (message: string, details?: unknown) =>
    new AppError(400, 'bad_request', message, details)
export const notFound = (what: string) => new AppError(404, 'not_found', `${what} not found`)
export const conflict = (message: string) => new AppError(409, 'conflict', message)
export const forbidden = (message: string) => new AppError(403, 'forbidden', message)

export function requireEntity<T>(entity: T | null | undefined, what: string): T {
    if (entity === null || entity === undefined) throw notFound(what)
    return entity
}

export type ErrorBody = {
    error: { code: ErrorCode; message: string; details?: unknown; requestId?: string }
}

export function errorBody(error: AppError, requestId?: string): ErrorBody {
    return {
        error: {
            code: error.code,
            message: error.message,
            ...(error.details === undefined ? {} : { details: error.details }),
            ...(requestId ? { requestId } : {}),
        },
    }
}

type MaybePromise<T> = T | Promise<T>

export type RouteInput<E extends EndpointDef> = {
    params: EndpointParams<E>
    query: EndpointQuery<E>
    body: EndpointParsedBody<E>
    c: Context<AppEnv>
}

type HandlerResult<E extends EndpointDef> = E['response'] extends 'binary'
    ? Response
    : E['response'] extends null
      ? void
      : EndpointResponse<E>

function validate<S extends z.ZodType>(schema: S, value: unknown, part: string): z.output<S> {
    const result = schema.safeParse(value)
    if (!result.success) {
        throw new AppError(400, 'validation_error', `Invalid ${part}`, result.error.issues)
    }
    return result.data
}

async function readBody(c: Context<AppEnv>, endpoint: EndpointDef) {
    if (!endpoint.body) return undefined

    if (endpoint.bodyType === 'form') {
        try {
            return await c.req.parseBody()
        } catch {
            throw new AppError(400, 'bad_request', 'Invalid form body')
        }
    }

    const text = await c.req.text()
    if (text.trim() === '') return {}
    try {
        return JSON.parse(text) as unknown
    } catch {
        throw new AppError(400, 'bad_request', 'Invalid JSON body')
    }
}

/**
 * Registers a contract endpoint. Params, query and body are validated with the contract
 * schemas; outside production the response is checked against the response schema too.
 */
export function route<E extends EndpointDef>(
    app: Hono<AppEnv>,
    endpoint: E,
    handler: (input: RouteInput<E>) => MaybePromise<HandlerResult<E>>,
) {
    app.on(endpoint.method, endpoint.path, async (c) => {
        const params = endpoint.params
            ? validate(endpoint.params, c.req.param(), 'path')
            : undefined
        const query = endpoint.query ? validate(endpoint.query, c.req.query(), 'query') : undefined
        const rawBody = await readBody(c, endpoint)
        const body = endpoint.body ? validate(endpoint.body, rawBody, 'body') : undefined

        const result = await handler({ params, query, body, c } as RouteInput<E>)

        if (endpoint.response === 'binary') return result as Response
        if (endpoint.response === null) return c.body(null, 204)

        if (c.get('validateResponses')) {
            const checked = endpoint.response.safeParse(result)
            if (!checked.success) {
                throw new AppError(
                    500,
                    'internal',
                    `Response for ${endpoint.method} ${endpoint.path} violates the contract`,
                    checked.error.issues,
                )
            }
        }

        return c.json(result as object, endpoint.status ?? 200)
    })
}

export function contentDisposition(filename: string) {
    const fallback = filename
        .split('')
        .map((char) => {
            const code = char.charCodeAt(0)
            return code >= 32 && code < 127 && char !== '"' && char !== '\\' ? char : '_'
        })
        .join('')

    return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}
