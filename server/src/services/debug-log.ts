import type { DebugSettings } from '@nai-factory/types'
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

let nextId = 1
const entries: DebugRequestEntry[] = []

function clampLimit(limit: number) {
    return Math.min(500, Math.max(1, Math.floor(limit) || 20))
}

function trim(limit: number) {
    entries.splice(clampLimit(limit))
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

export function beginDebugRequest(options: BeginDebugRequestOptions) {
    if (!options.settings.enabled) return null

    const startedAt = Date.now()
    const entry: DebugRequestEntry = {
        id: nextId++,
        createdAt: new Date(startedAt).toISOString(),
        completedAt: null,
        durationMs: null,
        status: 'pending',
        method: options.method,
        url: options.url,
        context: options.context ?? {},
        request: redact(options.request),
        response: null,
        error: null,
    }

    entries.unshift(entry)
    trim(options.settings.recentRequestLimit)
    emitChange()

    return {
        success(response: unknown) {
            const completedAt = Date.now()
            entry.completedAt = new Date(completedAt).toISOString()
            entry.durationMs = completedAt - startedAt
            entry.status = 'success'
            entry.response = redact(response)
            emitChange()
        },
        error(error: unknown) {
            const completedAt = Date.now()
            entry.completedAt = new Date(completedAt).toISOString()
            entry.durationMs = completedAt - startedAt
            entry.status = 'error'
            entry.error = error instanceof Error ? error.message : String(error)
            emitChange()
        },
    }
}

export function listDebugRequests() {
    return entries
}

export function clearDebugRequests() {
    entries.length = 0
    emitChange()
}
