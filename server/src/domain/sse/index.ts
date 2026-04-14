import { Elysia } from 'elysia'
import { domainEvents } from '@/services/events'

export const sse = new Elysia().get('/sse', ({ set }) => {
    const encoder = new TextEncoder()
    let unsubscribe: (() => void) | null = null
    let heartbeat: ReturnType<typeof setInterval> | null = null

    set.headers['Content-Type'] = 'text/event-stream'
    set.headers['Cache-Control'] = 'no-cache'
    set.headers['Connection'] = 'keep-alive'
    set.headers['X-Accel-Buffering'] = 'no'

    return new ReadableStream({
        start(controller) {
            controller.enqueue(encoder.encode(': connected\n\n'))

            unsubscribe = domainEvents.subscribe((event) => {
                try {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
                } catch {
                    // Stream already closed — listener will be cleaned up in cancel()
                }
            })

            // Keep the connection alive through proxies and load balancers
            heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(': ping\n\n'))
                } catch {
                    if (heartbeat) clearInterval(heartbeat)
                }
            }, 30_000)
        },

        cancel() {
            unsubscribe?.()
            if (heartbeat) clearInterval(heartbeat)
        },
    })
})
