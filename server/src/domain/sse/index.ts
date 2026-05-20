import { sse as buildSSE, Elysia } from 'elysia'
import { type DomainChangeEvent, domainEvents } from '../../services'

const PING = Symbol('ping')

class Channel<T> {
    private queue: T[] = []
    private resolve: ((v: T) => void) | null = null

    push(value: T) {
        if (this.resolve) {
            this.resolve(value)
            this.resolve = null
        } else {
            this.queue.push(value)
        }
    }

    next(): Promise<T> {
        const value = this.queue.shift()
        if (value !== undefined) return Promise.resolve(value)

        return new Promise((r) => (this.resolve = r))
    }
}

export const sse = new Elysia().get('/sse', async function* ({ request }) {
    const channel = new Channel<DomainChangeEvent | typeof PING>()

    const unsub = domainEvents.subscribe((e) => channel.push(e))
    const heartbeat = setInterval(() => channel.push(PING), 30_000)

    const onAbort = new Promise<null>((r) =>
        request.signal.addEventListener('abort', () => r(null), { once: true }),
    )

    request.signal.addEventListener(
        'abort',
        () => {
            unsub()
            clearInterval(heartbeat)
        },
        { once: true },
    )

    while (!request.signal.aborted) {
        const result = await Promise.race([channel.next(), onAbort])
        if (result === null) break
        if (result === PING) {
            yield buildSSE({ event: 'ping' })
        } else {
            yield buildSSE({ data: JSON.stringify(result) })
        }
    }
})
