import type { DebugSettings } from '@nai-factory/shared'
import { desc, eq } from 'drizzle-orm'
import { db, debugRequests, sqlite } from '@/db'
import logger from '@/logger'
import { realtimeEvents } from './app/events'

export type DebugRequestStatus = 'pending' | 'success' | 'error'

export interface DebugRequestEntry {
    id: number
    createdAt: string
    completedAt: string | null
    durationMs: number | null
    status: DebugRequestStatus
    method: string
    url: string
    context: Record<string, unknown>
    request: unknown
    response: unknown
    error: string | null
}

type BeginDebugRequestOptions = {
    settings: DebugSettings
    method: string
    url: string
    context?: Record<string, unknown>
    request: unknown
}

const log = logger.child({ module: 'debug-log' })

function clampLimit(limit: number) {
    return Math.min(500, Math.max(1, Math.floor(limit) || 20))
}

function trim(limit: number) {
    sqlite.run(
        `
            DELETE FROM debug_requests
            WHERE id NOT IN (
                SELECT id FROM debug_requests
                ORDER BY id DESC
                LIMIT ?
            )
        `,
        [clampLimit(limit)],
    )
}

function emitChange() {
    realtimeEvents.publish({ type: 'debug.requests.changed' })
}

function redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(redact)

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, nested]) => {
                const normalizedKey = key.toLowerCase()
                if (
                    normalizedKey.includes('api') ||
                    normalizedKey.includes('authorization') ||
                    normalizedKey.includes('token') ||
                    normalizedKey.includes('secret') ||
                    normalizedKey === 'data' ||
                    normalizedKey === 'image'
                ) {
                    return [key, '[redacted]']
                }

                return [key, redact(nested)]
            }),
        )
    }

    return value
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error)
}

function insertEntry(entry: Omit<DebugRequestEntry, 'id'>, limit: number) {
    try {
        const created = db
            .insert(debugRequests)
            .values(entry)
            .returning({ id: debugRequests.id })
            .get()
        trim(limit)
        emitChange()
        return created?.id ?? null
    } catch (error) {
        log.warn({ err: error }, 'Failed to write debug request log')
        return null
    }
}

function updateEntry(id: number, patch: Partial<Omit<DebugRequestEntry, 'id'>>) {
    try {
        db.update(debugRequests).set(patch).where(eq(debugRequests.id, id)).run()
        emitChange()
    } catch (error) {
        log.warn({ err: error, id }, 'Failed to update debug request log')
    }
}

export function beginDebugRequest(options: BeginDebugRequestOptions) {
    const startedAt = Date.now()
    const createdAt = new Date(startedAt).toISOString()
    const limit = options.settings.enabled ? options.settings.recentRequestLimit : 500
    const redactedContext = redact(options.context ?? {}) as Record<string, unknown>
    const redactedRequest = redact(options.request)
    const pendingEntry: Omit<DebugRequestEntry, 'id'> = {
        createdAt: new Date(startedAt).toISOString(),
        completedAt: null,
        durationMs: null,
        status: 'pending',
        method: options.method,
        url: options.url,
        context: redactedContext,
        request: redactedRequest,
        response: null,
        error: null,
    }
    let entryId = options.settings.enabled ? insertEntry(pendingEntry, limit) : null

    return {
        success(response: unknown) {
            if (entryId === null) return

            const completedAt = Date.now()
            updateEntry(entryId, {
                completedAt: new Date(completedAt).toISOString(),
                durationMs: completedAt - startedAt,
                status: 'success',
                response: redact(response),
            })
        },
        error(error: unknown) {
            const completedAt = Date.now()
            const errorPatch = {
                completedAt: new Date(completedAt).toISOString(),
                durationMs: completedAt - startedAt,
                status: 'error' as const,
                error: errorMessage(error),
            }

            if (entryId === null) {
                entryId = insertEntry(
                    {
                        ...pendingEntry,
                        ...errorPatch,
                        createdAt,
                    },
                    limit,
                )
                return
            }

            updateEntry(entryId, errorPatch)
        },
    }
}

export function listDebugRequests() {
    return db.select().from(debugRequests).orderBy(desc(debugRequests.id)).limit(500).all()
}

export function clearDebugRequests() {
    db.delete(debugRequests).run()
    emitChange()
}
