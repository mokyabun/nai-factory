import type { DebugRequest } from '@nai-factory/shared'
import { desc, eq, notInArray } from 'drizzle-orm'

import { type Db, debugRequests } from '@/db'
import type { RequestRecorder } from '@/integrations/novelai/client'
import { toIso } from '@/lib/time'
import type { Logger } from '@/logger'
import type { RealtimeHub } from '@/modules/realtime/hub'
import type { SettingsStore } from '@/modules/settings/service'

const MAX_ENTRIES = 500
const SENSITIVE_KEYS = ['api', 'authorization', 'token', 'secret', 'cookie', 'header']
const BINARY_KEYS = new Set(['data', 'image'])

/** Removes secrets, headers and large binary fields from logged payloads. */
export function redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(redact)
    if (value instanceof Uint8Array) return `[${value.byteLength} bytes]`
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, nested]) => {
                const lower = key.toLowerCase()
                if (SENSITIVE_KEYS.some((part) => lower.includes(part)) || BINARY_KEYS.has(lower)) {
                    return [key, '[redacted]']
                }
                return [key, redact(nested)]
            }),
        )
    }
    return value
}

function toEntity(row: typeof debugRequests.$inferSelect): DebugRequest {
    return {
        id: row.id,
        status: row.status,
        method: row.method,
        url: row.url,
        context: row.context,
        request: row.request ?? null,
        response: row.response ?? null,
        error: row.error,
        durationMs: row.durationMs,
        createdAt: toIso(row.createdAt),
        completedAt: toIso(row.completedAt),
    }
}

export type DebugLog = ReturnType<typeof createDebugLog>

/** Keeps recent NovelAI requests in the database while debug logging is enabled. */
export function createDebugLog(db: Db, events: RealtimeHub, settings: SettingsStore, log: Logger) {
    const changed = () => events.publish({ type: 'debug.requests.changed' })

    function trim(limit: number) {
        const keep = db
            .select({ id: debugRequests.id })
            .from(debugRequests)
            .orderBy(desc(debugRequests.id))
            .limit(limit)
            .all()
            .map((row) => row.id)
        db.delete(debugRequests).where(notInArray(debugRequests.id, keep)).run()
    }

    const recorder: RequestRecorder = {
        begin(entry) {
            const config = settings.get().debug
            if (!config.enabled) return { success() {}, error() {} }

            const startedAt = Date.now()
            let id: number | null = null
            try {
                id =
                    db
                        .insert(debugRequests)
                        .values({
                            status: 'pending',
                            method: entry.method,
                            url: entry.url,
                            context: redact(entry.context) as Record<string, unknown>,
                            request: redact(entry.request),
                            createdAt: new Date(startedAt),
                        })
                        .returning({ id: debugRequests.id })
                        .get()?.id ?? null
                trim(Math.min(config.recentRequestLimit, MAX_ENTRIES))
                changed()
            } catch (error) {
                log.warn({ err: error }, 'Failed to write debug request log')
            }

            const complete = (patch: Partial<typeof debugRequests.$inferInsert>) => {
                if (id === null) return
                try {
                    db.update(debugRequests)
                        .set({
                            ...patch,
                            completedAt: new Date(),
                            durationMs: Date.now() - startedAt,
                        })
                        .where(eq(debugRequests.id, id))
                        .run()
                    changed()
                } catch (error) {
                    log.warn({ err: error }, 'Failed to update debug request log')
                }
            }

            return {
                success: (response) => complete({ status: 'success', response: redact(response) }),
                error: (error) =>
                    complete({
                        status: 'error',
                        error: error instanceof Error ? error.message : String(error),
                    }),
            }
        },
    }

    return {
        recorder,

        list(): DebugRequest[] {
            return db
                .select()
                .from(debugRequests)
                .orderBy(desc(debugRequests.id))
                .limit(MAX_ENTRIES)
                .all()
                .map(toEntity)
        },

        clear() {
            db.delete(debugRequests).run()
            changed()
        },
    }
}
