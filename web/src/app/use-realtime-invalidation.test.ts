import type { QueueStatus } from '@nai-factory/shared'
import type { Query } from '@tanstack/react-query'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { emptyQueueStatus } from '@/features/queue/use-queue'
import { qk } from '@/lib/queries'

import { handleRealtimeEvent, syncActiveRealtimeQueries } from './use-realtime-invalidation'

function mockQuery(queryKey: readonly unknown[], active = true) {
    return { queryKey, isActive: () => active } as Query
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

        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.images.list(20) })
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.scenes.summary(20) })
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.scenes.list(10) })
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.settings.novelAIStatus() })
    })

    it('invalidates anlas status when playground images change', () => {
        const queryClient = new QueryClient()
        const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

        handleRealtimeEvent(queryClient, { type: 'playground.images.changed' })

        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.playground.images() })
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.settings.novelAIStatus() })
    })

    it('invalidates jobs and scene summaries when jobs change', () => {
        const queryClient = new QueryClient()
        const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

        handleRealtimeEvent(queryClient, { type: 'jobs.changed' })

        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.jobs.all() })
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.scenes.all() })
    })

    it('applies job progress to the cached status without refetching', () => {
        const queryClient = new QueryClient()
        const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
        const current: QueueStatus['current'] = {
            jobId: 7,
            kind: 'scene',
            projectId: 1,
            sceneId: 2,
            variationId: 3,
            label: 'scene',
            prompt: null,
            startedAt: '2026-01-01T00:00:00.000Z',
            total: 3,
            done: 0,
            imageStartedAt: null,
        }
        queryClient.setQueryData(qk.jobs.status(), { ...emptyQueueStatus, current })

        handleRealtimeEvent(queryClient, {
            type: 'job.progress',
            jobId: 7,
            done: 1,
            total: 3,
            imageStartedAt: '2026-01-01T00:00:05.000Z',
        })

        expect(queryClient.getQueryData<QueueStatus>(qk.jobs.status())?.current).toMatchObject({
            done: 1,
            imageStartedAt: '2026-01-01T00:00:05.000Z',
        })
        expect(invalidateQueries).not.toHaveBeenCalled()
    })

    it('refreshes NovelAI status only when its settings change', () => {
        const queryClient = new QueryClient()
        const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

        handleRealtimeEvent(queryClient, { type: 'settings.changed', sections: ['image'] })
        expect(invalidateQueries).not.toHaveBeenCalledWith({
            queryKey: qk.settings.novelAIStatus(),
        })

        handleRealtimeEvent(queryClient, { type: 'settings.changed', sections: ['novelai'] })
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.settings.novelAIStatus() })
    })

    it('resync refetches active realtime queries except the NovelAI status', () => {
        const queryClient = new QueryClient()
        const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

        syncActiveRealtimeQueries(queryClient)

        const predicate = invalidateQueries.mock.calls[0]?.[0]?.predicate
        expect(predicate?.(mockQuery(qk.jobs.status()))).toBe(true)
        expect(predicate?.(mockQuery(qk.playground.images()))).toBe(true)
        expect(predicate?.(mockQuery(qk.settings.get()))).toBe(true)
        expect(predicate?.(mockQuery(qk.settings.novelAIStatus()))).toBe(false)
        expect(predicate?.(mockQuery(qk.projects.get(1)))).toBe(false)
        expect(predicate?.(mockQuery(qk.images.list(1), false))).toBe(false)
    })
})
