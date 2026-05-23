import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { type DomainChangeEvent, domainEvents } from '#/services'

const PING = Symbol('ping')

class Channel<T> {
    private queue: T[] = []
    private resolve: ((value: T) => void) | null = null

    push(value: T) {
        if (this.resolve) {
            this.resolve(value)
            this.resolve = null
            return
        }

        this.queue.push(value)
    }

    next() {
        const value = this.queue.shift()
        if (value !== undefined) return Promise.resolve(value)
        return new Promise<T>((resolve) => {
            this.resolve = resolve
        })
    }
}

export const sse = new Hono().get('/sse', (c) =>
    streamSSE(c, async (stream) => {
        const channel = new Channel<DomainChangeEvent | typeof PING>()
        const unsubscribe = domainEvents.subscribe((event) => channel.push(event))
        const heartbeat = setInterval(() => channel.push(PING), 30_000)
        const request = c.req.raw
        const onAbort = new Promise<null>((resolve) =>
            request.signal.addEventListener('abort', () => resolve(null), { once: true }),
        )

        const cleanup = () => {
            unsubscribe()
            clearInterval(heartbeat)
        }

        stream.onAbort(cleanup)

        try {
            while (!request.signal.aborted) {
                const event = await Promise.race([channel.next(), onAbort])
                if (event === null) break
                if (event === PING) {
                    await stream.writeSSE({ data: '', event: 'ping' })
                } else {
                    await stream.writeSSE({ data: JSON.stringify(event) })
                }
            }
        } finally {
            cleanup()
        }
    }),
)
