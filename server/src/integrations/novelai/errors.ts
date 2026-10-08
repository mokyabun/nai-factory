export type NovelAIErrorKind =
    | 'auth'
    | 'rate_limit'
    | 'server'
    | 'bad_request'
    | 'timeout'
    | 'network'
    | 'aborted'

/** Failure talking to NovelAI, classified by HTTP status or transport error. */
export class NovelAIError extends Error {
    constructor(
        readonly kind: NovelAIErrorKind,
        message: string,
        readonly status: number | null = null,
        readonly retryable = false,
        readonly body?: string,
    ) {
        super(message)
        this.name = 'NovelAIError'
    }
}

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504])

export function isRetryableStatus(status: number) {
    return RETRYABLE_STATUSES.has(status)
}

function extractMessage(body: string) {
    if (!body) return null
    try {
        const data = JSON.parse(body) as { message?: unknown; error?: unknown }
        if (typeof data.message === 'string') return data.message
        if (typeof data.error === 'string') return data.error
    } catch {
        // Not JSON; fall back to the raw text.
    }
    return body.slice(0, 300)
}

export function errorFromResponse(operation: string, status: number, body: string) {
    const detail = extractMessage(body)
    const message = `${operation} failed (${status})${detail ? `: ${detail}` : ''}`

    if (status === 401 || status === 403)
        return new NovelAIError('auth', message, status, false, body)
    if (status === 429) return new NovelAIError('rate_limit', message, status, true, body)
    if (status >= 500) {
        return new NovelAIError('server', message, status, isRetryableStatus(status), body)
    }
    return new NovelAIError('bad_request', message, status, false, body)
}
