import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { type DomainChangeEvent, domainEvents } from '#/services'

const PING = Symbol('ping')
const CLOSED = Symbol('closed')

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

    next(): Promise<T> {
        const value = this.queue.shift()
        if (value !== undefined) return Promise.resolve(value)

        return new Promise((resolve) => {
            this.resolve = resolve
        })
    }
}

export const sse = new Hono().get('/sse', (c) =>
    streamSSE(c, async (stream) => {
        const channel = new Channel<DomainChangeEvent | typeof PING | typeof CLOSED>()
        const unsubscribe = domainEvents.subscribe((event) => channel.push(event))
        const heartbeat = setInterval(() => channel.push(PING), 30_000)

        const close = () => {
            unsubscribe()
            clearInterval(heartbeat)
            channel.push(CLOSED)
        }

        stream.onAbort(close)

        while (true) {
            const event = await channel.next()
            if (event === CLOSED) break
            if (event === PING) {
                await stream.writeSSE({ data: '', event: 'ping' })
                continue
            }

            await stream.writeSSE({ data: JSON.stringify(event) })
        }
    }),
)
