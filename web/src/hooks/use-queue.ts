import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { api, type QueueStatus, type SceneSummary } from '@/lib/api'
import { imageProgress, remainingSeconds, toServerNow } from '@/lib/generation-progress'
import {
    requireApiResult,
    restoreSnapshot,
    restoreSnapshots,
    snapshotQueries,
    snapshotQuery,
} from '@/lib/optimistic'
import { qk } from '@/lib/queries'

export const emptyQueueStatus: QueueStatus = {
    state: 'idle',
    pauseReason: null,
    running: false,
    processing: false,
    pendingCount: 0,
    estimatedSeconds: null,
    currentSceneId: null,
    currentJob: null,
    avgDurationMs: null,
    durationSampleSize: 0,
    completedCount: 0,
    failedCount: 0,
    recent: [],
    serverTime: new Date(0).toISOString(),
}

export function useQueueStatus() {
    const query = useQuery({
        queryKey: qk.queueStatus(),
        queryFn: async () => {
            const { data } = await api.queue.status.get()
            return data ?? emptyQueueStatus
        },
    })

    return {
        status: query.data ?? emptyQueueStatus,
        receivedAt: query.dataUpdatedAt,
        isPending: query.isPending,
    }
}

/** Server-clock time that ticks every second while `active`, for elapsed-time displays. */
export function useServerNow(status: QueueStatus, receivedAt: number, active: boolean) {
    const [localNow, setLocalNow] = useState(() => Date.now())

    useEffect(() => {
        if (!active) return
        const timer = window.setInterval(() => setLocalNow(Date.now()), 1000)
        return () => window.clearInterval(timer)
    }, [active])

    return toServerNow(localNow, status.serverTime, receivedAt)
}

/** Queue status plus client-side derived timing for the job currently generating. */
export function useGenerationStatus() {
    const { status, receivedAt } = useQueueStatus()
    const job = status.currentJob
    const counting = status.state === 'running' || status.state === 'pausing'
    const serverNow = useServerNow(status, receivedAt, job !== null || counting)

    return {
        status,
        job,
        progress: job ? imageProgress(job.imageStartedAt, status.avgDurationMs, serverNow) : null,
        jobElapsedMs: job ? Math.max(0, serverNow - Date.parse(job.startedAt)) : null,
        // A paused queue's estimate does not shrink while nothing runs.
        remainingSeconds: counting
            ? remainingSeconds(status.estimatedSeconds, status.serverTime, serverNow)
            : status.estimatedSeconds,
    }
}

function invalidateQueue(queryClient: ReturnType<typeof useQueryClient>) {
    void queryClient.invalidateQueries({ queryKey: qk.queueStatus() })
    void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'queue' && query.queryKey[1] === 'items',
    })
}

export function useQueueActions() {
    const queryClient = useQueryClient()

    const start = useMutation({
        mutationFn: () => requireApiResult(api.queue.start.post()),
        onMutate: async () => {
            const previousStatus = await snapshotQuery<QueueStatus>(queryClient, qk.queueStatus())
            queryClient.setQueryData<QueueStatus>(qk.queueStatus(), (status) => {
                const current = status ?? emptyQueueStatus
                const willRun = current.processing || current.pendingCount > 0
                return {
                    ...current,
                    running: true,
                    pauseReason: null,
                    state: willRun ? 'running' : current.state,
                }
            })
            return { previousStatus }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshot(queryClient, context?.previousStatus)
        },
        onSettled: () => invalidateQueue(queryClient),
    })

    const stop = useMutation({
        mutationFn: () => requireApiResult(api.queue.stop.post()),
        onMutate: async () => {
            const previousStatus = await snapshotQuery<QueueStatus>(queryClient, qk.queueStatus())
            queryClient.setQueryData<QueueStatus>(qk.queueStatus(), (status) => {
                const current = status ?? emptyQueueStatus
                return {
                    ...current,
                    running: false,
                    pauseReason: 'user',
                    state: current.processing ? 'pausing' : current.state,
                }
            })
            return { previousStatus }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshot(queryClient, context?.previousStatus)
        },
        onSettled: () => invalidateQueue(queryClient),
    })

    const clearAll = useMutation({
        mutationFn: () => requireApiResult(api.queue.delete()),
        onMutate: async () => {
            const snapshots = await snapshotQueries(queryClient, {
                predicate: (query) =>
                    query.queryKey[0] === 'queue' || query.queryKey[0] === 'scenes',
            })
            queryClient.setQueryData<QueueStatus>(qk.queueStatus(), (status) => ({
                ...(status ?? emptyQueueStatus),
                pendingCount: 0,
                estimatedSeconds: null,
            }))
            queryClient.setQueriesData(
                {
                    predicate: (query) =>
                        query.queryKey[0] === 'queue' && query.queryKey[1] === 'items',
                },
                [],
            )
            queryClient.setQueriesData<SceneSummary[]>(
                { predicate: (query) => query.queryKey[0] === 'scenes' },
                (scenes) => scenes?.map((scene) => ({ ...scene, queueCount: 0 })),
            )
            return { snapshots }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshots(queryClient, context?.snapshots)
        },
        onSettled: () => invalidateQueue(queryClient),
    })

    return { start, stop, clearAll }
}
