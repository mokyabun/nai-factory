import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { type DomainChangeEvent, domainEvents } from '#/services'

const PING = Symbol('ping')
<<<<<<< HEAD
const CLOSED = Symbol('closed')
=======
>>>>>>> refs/remotes/origin/main

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

<<<<<<< HEAD
    next(): Promise<T> {
        const value = this.queue.shift()
        if (value !== undefined) return Promise.resolve(value)

        return new Promise((resolve) => {
=======
    next() {
        const value = this.queue.shift()
        if (value !== undefined) return Promise.resolve(value)
        return new Promise<T>((resolve) => {
>>>>>>> refs/remotes/origin/main
            this.resolve = resolve
        })
    }
}

<<<<<<< HEAD
export const sse = new Hono().get('/', (c) => {
    return streamSSE(c, async (stream) => {
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
                await stream.writeSSE({ event: 'ping', data: '' })
                continue
            }

            await stream.writeSSE({ data: JSON.stringify(event) })
        }
    })
})
=======
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
>>>>>>> refs/remotes/origin/main
