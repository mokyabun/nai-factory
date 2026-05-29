import { EventEmitter } from 'node:events'
import type { RealtimeEvent } from '@nai-factory/shared'

class RealtimeEventService extends EventEmitter {
    private pending = new Map<string, RealtimeEvent>()
    private timer: ReturnType<typeof setTimeout> | null = null

    /** Enqueue an event. Duplicate payloads within the flush window are collapsed. */
    publish(event: RealtimeEvent): void {
        this.pending.set(JSON.stringify(event), event)
        if (this.timer === null) {
            this.timer = setTimeout(() => this.flush(), 0)
        }
    }

    private flush(): void {
        this.timer = null
        for (const event of this.pending.values()) {
            this.emit('change', event)
        }
        this.pending.clear()
    }

    subscribe(listener: (event: RealtimeEvent) => void): () => void {
        this.on('change', listener)
        return () => this.off('change', listener)
    }
}

const service = new RealtimeEventService()
// Allow up to 200 concurrent SSE clients without MaxListenersExceededWarning
service.setMaxListeners(200)

export const realtimeEvents = service
