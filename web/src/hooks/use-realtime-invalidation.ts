import { EVENTS_PATH, type QueueStatus, type RealtimeEvent } from '@nai-factory/shared'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { useEffect } from 'react'

import { qk } from '@/lib/queries'

const REALTIME_ROOTS = new Set(['jobs', 'images', 'scenes', 'playground', 'settings', 'debug'])

function isNovelAIStatus(queryKey: QueryKey) {
    return queryKey[0] === 'settings' && queryKey[1] === 'novelai-status'
}

/**
 * After a `resync` (missed events could not be replayed) refetch every active query that
 * realtime events keep fresh. The NovelAI account status is left alone: it calls NovelAI.
 */
export function syncActiveRealtimeQueries(queryClient: QueryClient) {
    void queryClient.invalidateQueries({
        predicate: (query) =>
            query.isActive() &&
            REALTIME_ROOTS.has(String(query.queryKey[0])) &&
            !isNovelAIStatus(query.queryKey),
    })
}

export function handleRealtimeEvent(queryClient: QueryClient, event: RealtimeEvent) {
    switch (event.type) {
        case 'job.progress':
            // Progress updates the cached status directly instead of refetching it.
            queryClient.setQueryData<QueueStatus>(qk.jobs.status(), (status) =>
                status?.current?.jobId === event.jobId
                    ? {
                          ...status,
                          current: {
                              ...status.current,
                              done: event.done,
                              total: event.total,
                              imageStartedAt: event.imageStartedAt,
                          },
                      }
                    : status,
            )
            break
        case 'jobs.changed':
            void queryClient.invalidateQueries({ queryKey: qk.jobs.all() })
            // Scene cards show how many jobs are queued for them.
            void queryClient.invalidateQueries({ queryKey: qk.scenes.all() })
            break
        case 'scene.images.changed':
            void queryClient.invalidateQueries({ queryKey: qk.images.list(event.sceneId) })
            void queryClient.invalidateQueries({ queryKey: qk.scenes.summary(event.sceneId) })
            void queryClient.invalidateQueries({ queryKey: qk.scenes.list(event.projectId) })
            void queryClient.invalidateQueries({ queryKey: qk.settings.novelAIStatus() })
            break
        case 'playground.images.changed':
            void queryClient.invalidateQueries({ queryKey: qk.playground.images() })
            void queryClient.invalidateQueries({ queryKey: qk.settings.novelAIStatus() })
            break
        case 'settings.changed':
            void queryClient.invalidateQueries({ queryKey: qk.settings.get() })
            if (event.sections.includes('novelai')) {
                void queryClient.invalidateQueries({ queryKey: qk.settings.novelAIStatus() })
            }
            break
        case 'debug.requests.changed':
            void queryClient.invalidateQueries({ queryKey: qk.debug.requests() })
            break
        case 'resync':
            syncActiveRealtimeQueries(queryClient)
            break
    }
}

function parseEvent(data: string): RealtimeEvent | null {
    try {
        const value = JSON.parse(data) as unknown
        if (value && typeof value === 'object' && 'type' in value) return value as RealtimeEvent
    } catch {
        // Ignore malformed messages.
    }
    return null
}

/**
 * Subscribes to server events. EventSource reconnects on its own and sends `Last-Event-ID`,
 * so the server replays what was missed and only asks for a full refetch when it cannot.
 */
export function useRealtimeInvalidation(queryClient: QueryClient) {
    useEffect(() => {
        const source = new EventSource(EVENTS_PATH)
        source.onmessage = (message: MessageEvent<string>) => {
            const event = parseEvent(message.data)
            if (event) handleRealtimeEvent(queryClient, event)
        }
        return () => source.close()
    }, [queryClient])
}
