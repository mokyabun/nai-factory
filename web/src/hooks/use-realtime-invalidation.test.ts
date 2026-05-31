import type { Query } from '@tanstack/react-query'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { qk } from '@/lib/queries'
import { handleRealtimeEvent, syncActiveRealtimeQueries } from './use-realtime-invalidation'

function mockQuery(queryKey: readonly unknown[], active = true) {
    return {
        queryKey,
        isActive: () => active,
    } as Query
}

describe('realtime invalidation', () => {
    it('invalidates exact scene image queries', () => {
        const queryClient = new QueryClient()
        const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

        handleRealtimeEvent(queryClient, {
            type: 'scene.images.changed',
            projectId: 10,
            sceneId: 20,
        })

        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.images(20) })
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.scene(20) })
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.scenes(10) })
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.novelAIStatus() })
    })

    it('invalidates anlas status when playground images change', () => {
        const queryClient = new QueryClient()
        const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

        handleRealtimeEvent(queryClient, { type: 'playground.images.changed' })

        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.playgroundImages() })
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.novelAIStatus() })
    })

    it('invalidates queue status and active queue lists only for queue events', () => {
        const queryClient = new QueryClient()
        const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

        handleRealtimeEvent(queryClient, { type: 'queue.changed' })

        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.queueStatus() })
        const predicate = invalidateQueries.mock.calls[1]?.[0]?.predicate

        expect(predicate?.(mockQuery(qk.queue(1)))).toBe(true)
        expect(predicate?.(mockQuery(qk.queue(null), false))).toBe(false)
        expect(predicate?.(mockQuery(qk.scenes(1)))).toBe(false)
    })

    it('reconnect sync is limited to active realtime queries', () => {
        const queryClient = new QueryClient()
        const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

        syncActiveRealtimeQueries(queryClient)

        expect(invalidateQueries).not.toHaveBeenCalledWith()

        const predicate = invalidateQueries.mock.calls[0]?.[0]?.predicate
        expect(predicate?.(mockQuery(qk.queueStatus()))).toBe(true)
        expect(predicate?.(mockQuery(qk.playgroundImages()))).toBe(true)
        expect(predicate?.(mockQuery(qk.novelAIStatus()))).toBe(true)
        expect(predicate?.(mockQuery(qk.playgroundSettings()))).toBe(false)
        expect(predicate?.(mockQuery(qk.settings()))).toBe(false)
        expect(predicate?.(mockQuery(qk.images(1), false))).toBe(false)
    })
})
