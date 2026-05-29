import { HTTPException } from 'hono/http-exception'

export function httpError(status: 400 | 404 | 500, message: string) {
    return new HTTPException(status, { message })
}

export function requireEntity<T>(entity: T | null | undefined, message: string): T {
    if (!entity) throw httpError(404, message)
    return entity
}

export function nowIso() {
    return new Date().toISOString()
}

export function withUpdatedAt<T extends object>(data: T) {
    return { ...data, updatedAt: nowIso() }
}
