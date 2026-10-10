import { EVENTS_PATH, type RealtimeEvent } from '@nai-factory/shared'
import type { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'

import type { AppContext, AppEnv } from '@/context'

import type { RealtimeMessage } from './hub'

type Item = RealtimeMessage | 'ping' | 'closed'

function parseLastEventId(value: string | undefined) {
    if (!value) return null
    const id = Number(value)
    return Number.isSafeInteger(id) && id >= 0 ? id : null
}

export function registerRealtimeRoutes(app: Hono<AppEnv>, ctx: AppContext) {
    app.get(EVENTS_PATH, (c) =>
        streamSSE(c, async (stream) => {
            const items: Item[] = []
            let wake: (() => void) | null = null
            const push = (item: Item) => {
                items.push(item)
                wake?.()
                wake = null
            }

            const unsubscribe = ctx.events.subscribe(push)
            const heartbeat = setInterval(() => push('ping'), ctx.config.sseHeartbeatMs)
            stream.onAbort(() => {
                unsubscribe()
                clearInterval(heartbeat)
                push('closed')
            })

            let sentUpTo = 0
            const writeEvent = async (id: number, event: RealtimeEvent) => {
                sentUpTo = Math.max(sentUpTo, id)
                await stream.writeSSE({
                    id: String(id),
                    event: 'message',
                    data: JSON.stringify(event),
                })
            }

            const lastEventId = parseLastEventId(
                c.req.header('last-event-id') ?? c.req.query('lastEventId'),
            )
            if (lastEventId !== null) {
                const missed = ctx.events.since(lastEventId)
                if (missed === null) {
                    await writeEvent(ctx.events.lastId, { type: 'resync' })
                } else {
                    for (const message of missed) await writeEvent(message.id, message.event)
                }
            } else {
                // Tell new clients where the stream starts so their first reconnect can resume.
                sentUpTo = ctx.events.lastId
                await stream.writeSSE({ id: String(sentUpTo), event: 'ready', data: '{}' })
            }

            while (true) {
                const item = items.shift()
                if (item === undefined) {
                    await new Promise<void>((resolve) => (wake = resolve))
                    continue
                }
                if (item === 'closed') break
                if (item === 'ping') {
                    await stream.writeSSE({ event: 'ping', data: '' })
                    continue
                }
                // Skip events already replayed above.
                if (item.id <= sentUpTo) continue
                await writeEvent(item.id, item.event)
            }
        }),
    )
}
