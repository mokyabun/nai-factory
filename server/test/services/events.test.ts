import { describe, expect, it } from 'bun:test'
import type { RealtimeEvent } from '@nai-factory/types'
import { realtimeEvents } from '../../src/services/app/events'

function waitForFlush() {
    return new Promise((resolve) => setTimeout(resolve, 5))
}

describe('realtime events', () => {
    it('publishes events to subscribers', async () => {
        const events: RealtimeEvent[] = []
        const unsubscribe = realtimeEvents.subscribe((event) => events.push(event))

        realtimeEvents.publish({ type: 'queue.changed' })
        await waitForFlush()
        unsubscribe()

        expect(events).toEqual([{ type: 'queue.changed' }])
    })

    it('coalesces duplicate events within one flush', async () => {
        const events: RealtimeEvent[] = []
        const unsubscribe = realtimeEvents.subscribe((event) => events.push(event))

        realtimeEvents.publish({ type: 'queue.changed' })
        realtimeEvents.publish({ type: 'queue.changed' })
        realtimeEvents.publish({ type: 'playground.images.changed' })
        await waitForFlush()
        unsubscribe()

        expect(events).toEqual([{ type: 'queue.changed' }, { type: 'playground.images.changed' }])
    })
})
