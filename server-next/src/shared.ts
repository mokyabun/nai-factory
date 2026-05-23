import { generateKeyBetween } from 'fractional-indexing-jittered'
import { HTTPException } from 'hono/http-exception'

export function requireEntity<T>(entity: T | null | undefined, message: string): T {
    if (!entity) throw new HTTPException(404, { message })
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
