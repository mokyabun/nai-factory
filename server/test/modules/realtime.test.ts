import { afterAll, describe, expect, it } from 'bun:test'

import { contract, EVENTS_PATH } from '@nai-factory/shared'

import { createApp } from '@/app'
import { createRealtimeHub } from '@/modules/realtime/hub'

import { createTestApp } from '../helpers/app'

type SseMessage = { id?: string; event?: string; data?: string }

/** Reads SSE messages until `count` arrived or the timeout passes. */
async function readMessages(response: Response, count: number, timeoutMs = 2000) {
    const reader = (response.body as ReadableStream<Uint8Array>).getReader()
    const decoder = new TextDecoder()
    const messages: SseMessage[] = []
    let buffer = ''
    const deadline = Date.now() + timeoutMs

    while (messages.length < count && Date.now() < deadline) {
        const result = await Promise.race([
            reader.read(),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), deadline - Date.now())),
        ])
        if (!result || result.done) break
        buffer += decoder.decode(result.value, { stream: true })
        let index
        while ((index = buffer.indexOf('\n\n')) !== -1) {
            const block = buffer.slice(0, index)
            buffer = buffer.slice(index + 2)
            const message: SseMessage = {}
            for (const line of block.split('\n')) {
                const [key, ...rest] = line.split(':')
                const value = rest.join(':').trimStart()
                if (key === 'id' || key === 'event' || key === 'data') message[key] = value
            }
            messages.push(message)
        }
    }
    await reader.cancel()
    return messages
}

describe('realtime hub', () => {
    it('merges identical events published in the same tick', () => {
        const hub = createRealtimeHub()
        const received: string[] = []
        hub.subscribe(({ event }) => received.push(event.type))
        hub.publish({ type: 'jobs.changed' })
        hub.publish({ type: 'jobs.changed' })
        hub.publish({ type: 'job.progress', jobId: 1, done: 0, total: 2, imageStartedAt: null })
        hub.publish({ type: 'job.progress', jobId: 1, done: 1, total: 2, imageStartedAt: null })
        hub.flush()
        expect(received).toEqual(['jobs.changed', 'job.progress'])
    })

    it('replays events after an id and asks for a resync when they were dropped', () => {
        const hub = createRealtimeHub(3)
        for (let i = 0; i < 5; i++) {
            hub.publish({ type: 'scene.images.changed', projectId: 1, sceneId: i })
            hub.flush()
        }
        expect(hub.since(3)?.map((message) => message.id)).toEqual([4, 5])
        expect(hub.since(5)).toEqual([])
        expect(hub.since(1)).toBeNull()
        expect(hub.since(99)).toBeNull()
    })
})

describe('SSE endpoint', async () => {
    const t = await createTestApp()
    afterAll(() => t.close())

    it('sends missed events to a client reconnecting with Last-Event-ID', async () => {
        const first = await t.request(EVENTS_PATH)
        const [ready] = await readMessages(first, 1)
        expect(ready?.event).toBe('ready')

        await t.call(contract.settings.update, { body: { debug: { enabled: false } } })
        await t.call(contract.jobs.start)
        t.ctx.events.flush()

        const reconnect = await t.request(EVENTS_PATH, { headers: { 'last-event-id': ready!.id! } })
        const messages = await readMessages(reconnect, 2)
        const types = messages.map((message) => JSON.parse(message.data ?? '{}').type)
        expect(types).toContain('settings.changed')
        expect(types).toContain('jobs.changed')
    })

    it('tells clients with an unknown id to resync', async () => {
        const response = await t.request(EVENTS_PATH, { headers: { 'last-event-id': '999999' } })
        const [message] = await readMessages(response, 1)
        expect(JSON.parse(message?.data ?? '{}')).toEqual({ type: 'resync' })
    })
})

describe('B4: SSE connections stay open', () => {
    it(
        'keeps streaming pings past the default idle timeout',
        async () => {
            const t = await createTestApp({ env: { NAI_FACTORY_SSE_HEARTBEAT_MS: '1000' } })
            const server = Bun.serve({
                port: 0,
                hostname: '127.0.0.1',
                idleTimeout: 0,
                fetch: createApp(t.ctx).fetch,
            })
            try {
                const response = await fetch(new URL(EVENTS_PATH, server.url))
                const messages = await readMessages(response, 12, 11_500)
                expect(
                    messages.filter((message) => message.event === 'ping').length,
                ).toBeGreaterThanOrEqual(10)
            } finally {
                await server.stop(true)
                await t.close()
            }
        },
        { timeout: 15_000 },
    )
})
