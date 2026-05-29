import type { RealtimeEvent } from '@nai-factory/shared'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { useEffect } from 'react'
import { BASE_URL } from '@/lib/api'
import { qk } from '@/lib/queries'

function hasRoot(queryKey: QueryKey, root: string, scope?: string) {
    return queryKey[0] === root && (scope === undefined || queryKey[1] === scope)
}

function isActiveRealtimeQuery(queryKey: QueryKey) {
    return (
        hasRoot(queryKey, 'queue') ||
        hasRoot(queryKey, 'images') ||
        hasRoot(queryKey, 'scene') ||
        hasRoot(queryKey, 'scenes') ||
        hasRoot(queryKey, 'playground', 'images') ||
        hasRoot(queryKey, 'debug', 'requests')
    )
}

function invalidateActiveQueueLists(queryClient: QueryClient) {
    queryClient.invalidateQueries({
        predicate: (query) => query.isActive() && hasRoot(query.queryKey, 'queue', 'items'),
    })
}

export function syncActiveRealtimeQueries(queryClient: QueryClient) {
    queryClient.invalidateQueries({
        predicate: (query) => query.isActive() && isActiveRealtimeQuery(query.queryKey),
    })
}

function isRealtimeEvent(value: unknown): value is RealtimeEvent {
    if (!value || typeof value !== 'object' || !('type' in value)) return false

    const event = value as Partial<RealtimeEvent>
    if (event.type === 'queue.changed') return true
    if (event.type === 'playground.images.changed') return true
    if (event.type === 'debug.requests.changed') return true
    if (event.type !== 'scene.images.changed') return false

    return (
        'projectId' in event &&
        'sceneId' in event &&
        typeof event.projectId === 'number' &&
        typeof event.sceneId === 'number'
    )
}

export function handleRealtimeEvent(queryClient: QueryClient, event: RealtimeEvent) {
    switch (event.type) {
        case 'queue.changed':
            queryClient.invalidateQueries({ queryKey: qk.queueStatus() })
            invalidateActiveQueueLists(queryClient)
            break
        case 'scene.images.changed':
            queryClient.invalidateQueries({ queryKey: qk.images(event.sceneId) })
            queryClient.invalidateQueries({ queryKey: qk.scene(event.sceneId) })
            queryClient.invalidateQueries({ queryKey: qk.scenes(event.projectId) })
            break
        case 'playground.images.changed':
            queryClient.invalidateQueries({ queryKey: qk.playgroundImages() })
            break
        case 'debug.requests.changed':
            queryClient.invalidateQueries({ queryKey: qk.debugRequests() })
            break
    }
}

export function useRealtimeInvalidation(queryClient: QueryClient) {
    useEffect(() => {
        const es = new EventSource(`${BASE_URL}/sse`)
        let opened = false

        es.addEventListener('open', () => {
            if (opened) syncActiveRealtimeQueries(queryClient)
            opened = true
        })

        es.onmessage = (e: MessageEvent<string>) => {
            try {
                const event = JSON.parse(e.data) as unknown
                if (isRealtimeEvent(event)) handleRealtimeEvent(queryClient, event)
            } catch {
                // ignore malformed messages
            }
        }

        return () => es.close()
    }, [queryClient])
}
