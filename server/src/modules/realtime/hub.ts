import type { RealtimeEvent } from '@nai-factory/shared'

export type RealtimeMessage = { id: number; event: RealtimeEvent }
type Listener = (message: RealtimeMessage) => void

const DEFAULT_BUFFER_SIZE = 500

function coalesceKey(event: RealtimeEvent) {
    // Progress events for a job replace each other; everything else collapses by payload.
    return event.type === 'job.progress' ? `job.progress:${event.jobId}` : JSON.stringify(event)
}

export type RealtimeHub = ReturnType<typeof createRealtimeHub>

/** Merges identical events in a tick and buffers recent ones for `Last-Event-ID` catch-up. */
export function createRealtimeHub(bufferSize = DEFAULT_BUFFER_SIZE) {
    const buffer: RealtimeMessage[] = []
    const listeners = new Set<Listener>()
    const pending = new Map<string, RealtimeEvent>()
    let lastId = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    function flush() {
        timer = null
        for (const event of pending.values()) {
            const message = { id: ++lastId, event }
            buffer.push(message)
            if (buffer.length > bufferSize) buffer.shift()
            for (const listener of listeners) listener(message)
        }
        pending.clear()
    }

    return {
        publish(event: RealtimeEvent) {
            const key = coalesceKey(event)
            pending.delete(key)
            pending.set(key, event)
            timer ??= setTimeout(flush, 0)
        },

        subscribe(listener: Listener) {
            listeners.add(listener)
            return () => {
                listeners.delete(listener)
            }
        },

        get lastId() {
            return lastId
        },

        /** Null when some events were dropped or the id is from another run; the client must resync. */
        since(afterId: number): RealtimeMessage[] | null {
            if (afterId > lastId) return null
            if (afterId === lastId) return []
            const first = buffer[0]
            if (!first || first.id > afterId + 1) return null
            return buffer.filter((message) => message.id > afterId)
        },

        /** Delivers pending events immediately (tests and shutdown). */
        flush() {
            if (timer) clearTimeout(timer)
            flush()
        },
    }
}
