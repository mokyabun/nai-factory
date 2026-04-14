import { EventEmitter } from 'node:events'

export type EventDomain = 'queue' | 'images'

export interface DomainChangeEvent {
    domain: EventDomain
}

class DomainEventService extends EventEmitter {
    private pending = new Set<EventDomain>()
    private timer: ReturnType<typeof setTimeout> | null = null

    /** Enqueue a domain change. Duplicate domains within the flush window are collapsed. */
    invalidate(domain: EventDomain): void {
        this.pending.add(domain)
        if (this.timer === null) {
            this.timer = setTimeout(() => this.flush(), 20)
        }
    }

    private flush(): void {
        this.timer = null
        for (const domain of this.pending) {
            this.emit('change', { domain } satisfies DomainChangeEvent)
        }
        this.pending.clear()
    }

    subscribe(listener: (event: DomainChangeEvent) => void): () => void {
        this.on('change', listener)
        return () => this.off('change', listener)
    }
}

const service = new DomainEventService()
// Allow up to 200 concurrent SSE clients without MaxListenersExceededWarning
service.setMaxListeners(200)

export const domainEvents = service
