import {
    API_PREFIX,
    assetPath,
    buildPath,
    type EndpointBody,
    type EndpointDef,
    type EndpointParams,
    type EndpointQuery,
    type EndpointResponse,
} from '@nai-factory/shared'

/** A failed API call, carrying the server's `{ error: { code, message } }` payload. */
export class ApiError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
        readonly details?: unknown,
        readonly requestId?: string,
    ) {
        super(message)
        this.name = 'ApiError'
    }
}

type Optional<K extends string, T> = undefined extends T ? { [P in K]?: T } : { [P in K]: T }

/** Inputs of an endpoint; keys are required exactly when the endpoint declares them. */
export type CallInput<E extends EndpointDef> = Optional<'params', EndpointParams<E>> &
    Optional<'query', EndpointQuery<E>> &
    Optional<'body', EndpointBody<E>> & { signal?: AbortSignal }

type CallArgs<E extends EndpointDef> =
    {} extends CallInput<E> ? [input?: CallInput<E>] : [input: CallInput<E>]

const listeners = new Set<(error: ApiError) => void>()

/** Observes every failed call (used to show the access-token prompt on 401). */
export function onApiError(listener: (error: ApiError) => void) {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

export function toQueryString(query: unknown) {
    if (!query || typeof query !== 'object') return ''
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
        if (value === undefined || value === null) continue
        params.set(
            key,
            Array.isArray(value) ? value.join(',') : String(value as string | number | boolean),
        )
    }
    const text = params.toString()
    return text ? `?${text}` : ''
}

function toFormData(body: unknown) {
    const form = new FormData()
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
        if (value === undefined || value === null) continue
        if (value instanceof Blob) {
            form.set(key, value, value instanceof File ? value.name : 'blob')
        } else {
            form.set(key, String(value as string | number | boolean))
        }
    }
    return form
}

async function readError(response: Response) {
    const text = await response.text().catch(() => '')
    try {
        const parsed = JSON.parse(text) as {
            error?: { code?: string; message?: string; details?: unknown; requestId?: string }
        }
        if (parsed.error?.message) {
            return new ApiError(
                response.status,
                parsed.error.code ?? 'error',
                parsed.error.message,
                parsed.error.details,
                parsed.error.requestId,
            )
        }
    } catch {
        // Not a JSON error body.
    }
    return new ApiError(response.status, 'error', text || response.statusText || 'Request failed')
}

/** Calls an API endpoint from the shared contract and returns its typed response. */
export async function call<E extends EndpointDef>(
    endpoint: E,
    ...[input]: CallArgs<E>
): Promise<EndpointResponse<E>> {
    const options = (input ?? {}) as {
        params?: Record<string, unknown>
        query?: unknown
        body?: unknown
        signal?: AbortSignal
    }
    const url = `${API_PREFIX}${buildPath(endpoint.path, options.params)}${toQueryString(options.query)}`
    const headers: Record<string, string> = { Accept: 'application/json' }
    let body: BodyInit | undefined
    if (options.body !== undefined) {
        if (endpoint.bodyType === 'form') {
            body = toFormData(options.body)
        } else {
            headers['Content-Type'] = 'application/json'
            body = JSON.stringify(options.body)
        }
    }

    let response: Response
    try {
        response = await fetch(url, {
            method: endpoint.method,
            headers,
            body,
            credentials: 'same-origin',
            cache: 'no-store',
            signal: options.signal,
        })
    } catch (error) {
        const failure = new ApiError(
            0,
            'network',
            error instanceof Error ? error.message : 'Network error',
        )
        for (const listener of listeners) listener(failure)
        throw failure
    }

    if (!response.ok) {
        const error = await readError(response)
        for (const listener of listeners) listener(error)
        throw error
    }

    if (endpoint.response === null || response.status === 204) {
        return null as EndpointResponse<E>
    }
    if (endpoint.response === 'binary') return (await response.blob()) as EndpointResponse<E>
    return (await response.json()) as EndpointResponse<E>
}

/** URL of a stored file. Assets are immutable, so no cache busting is needed. */
export function assetUrl(assetId: number) {
    return assetPath(assetId)
}

/** Message for any thrown value, preferring the server's error message. */
export function errorMessage(error: unknown, fallback = '요청에 실패했습니다') {
    if (error instanceof Error && error.message) return error.message
    return fallback
}
