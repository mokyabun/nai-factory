import { generateKeyBetween } from 'fractional-indexing-jittered'
import { HTTPException } from 'hono/http-exception'

<<<<<<< HEAD
export function httpError(status: 400 | 404 | 500, message: string) {
    return new HTTPException(status, { message })
}

export function requireEntity<T>(entity: T | null | undefined, message: string): T {
    if (!entity) throw httpError(404, message)
=======
export function requireEntity<T>(entity: T | null | undefined, message: string): T {
    if (!entity) throw new HTTPException(404, { message })
>>>>>>> refs/remotes/origin/main
    return entity
}

export function nowIso() {
    return new Date().toISOString()
}

export function withUpdatedAt<T extends object>(data: T) {
    return { ...data, updatedAt: nowIso() }
}

export function nextDisplayOrder(after?: string | null) {
    return generateKeyBetween(after ?? null, null)
}

export function displayOrderBetween(prev?: string | null, next?: string | null) {
    return generateKeyBetween(prev ?? null, next ?? null)
}
