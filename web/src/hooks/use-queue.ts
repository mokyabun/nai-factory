import type { Job, QueueStatus, SceneSummary } from '@nai-factory/shared'
import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { call, contract } from '@/lib/api'
import { imageProgress, remainingSeconds, toServerNow } from '@/lib/generation-progress'
import { restoreSnapshot, restoreSnapshots, snapshotQueries, snapshotQuery } from '@/lib/optimistic'
import { qk } from '@/lib/queries'

export const emptyQueueStatus: QueueStatus = {
    state: 'idle',
    pauseReason: null,
    pendingCount: 0,
    estimatedSeconds: null,
    current: null,
    avgImageMs: null,
    sampleSize: 0,
    completedCount: 0,
    failedCount: 0,
    serverTime: new Date(0).toISOString(),
}

export function useQueueStatus() {
    const query = useQuery({
        queryKey: qk.jobs.status(),
        queryFn: () => call(contract.jobs.status),
    })

    return {
        status: query.data ?? emptyQueueStatus,
        receivedAt: query.dataUpdatedAt,
        isPending: query.isPending,
    }
}

/** Finished jobs, newest first (kept in the database, so they survive restarts). */
export function useJobHistory() {
    return useQuery({
        queryKey: qk.jobs.history(),
        queryFn: () => call(contract.jobs.history, { query: { limit: 50 } }),
    })
}

/** Server-clock time that ticks every second while `active`, for elapsed-time displays. */
function useServerNow(status: QueueStatus, receivedAt: number, active: boolean) {
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
    const job = status.current
    const counting = status.state === 'running' || status.state === 'pausing'
    const serverNow = useServerNow(status, receivedAt, job !== null || counting)

    return {
        status,
        job,
        progress: job ? imageProgress(job.imageStartedAt, status.avgImageMs, serverNow) : null,
        jobElapsedMs: job ? Math.max(0, serverNow - Date.parse(job.startedAt)) : null,
        // A paused queue's estimate does not shrink while nothing runs.
        remainingSeconds: counting
            ? remainingSeconds(status.estimatedSeconds, status.serverTime, serverNow)
            : status.estimatedSeconds,
    }
}

function invalidateQueue(queryClient: QueryClient) {
    void queryClient.invalidateQueries({ queryKey: qk.jobs.all() })
}

function isJobList(queryKey: readonly unknown[]) {
    return queryKey[0] === 'jobs' && queryKey[1] === 'list'
}

export function useQueueActions() {
    const queryClient = useQueryClient()

    const start = useMutation({
        mutationFn: () => call(contract.jobs.start),
        onMutate: async () => {
            const previousStatus = await snapshotQuery<QueueStatus>(queryClient, qk.jobs.status())
            queryClient.setQueryData<QueueStatus>(qk.jobs.status(), (status) => {
                const current = status ?? emptyQueueStatus
                return {
                    ...current,
                    pauseReason: null,
                    state: current.pendingCount > 0 ? 'running' : current.state,
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
        mutationFn: () => call(contract.jobs.stop),
        onMutate: async () => {
            const previousStatus = await snapshotQuery<QueueStatus>(queryClient, qk.jobs.status())
            queryClient.setQueryData<QueueStatus>(qk.jobs.status(), (status) => {
                const current = status ?? emptyQueueStatus
                return {
                    ...current,
                    pauseReason: 'user',
                    state: current.state === 'running' ? 'pausing' : current.state,
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
        mutationFn: () => call(contract.jobs.clear, { query: {} }),
        onMutate: async () => {
            const snapshots = await snapshotQueries(queryClient, {
                predicate: (query) => isJobList(query.queryKey) || query.queryKey[0] === 'scenes',
            })
            queryClient.setQueriesData<Job[]>(
                { predicate: (query) => isJobList(query.queryKey) },
                (jobs) => jobs?.filter((job) => job.status === 'running'),
            )
            queryClient.setQueriesData<SceneSummary[]>({ queryKey: qk.scenes.all() }, (scenes) =>
                Array.isArray(scenes)
                    ? scenes.map((scene) => ({ ...scene, queueCount: 0 }))
                    : scenes,
            )
            return { snapshots }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshots(queryClient, context?.snapshots)
        },
        onSettled: () => {
            invalidateQueue(queryClient)
            void queryClient.invalidateQueries({ queryKey: qk.scenes.all() })
        },
    })

    /** Removes a waiting job, or cancels the one that is running. */
    const remove = useMutation({
        mutationFn: (jobId: number) => call(contract.jobs.delete, { params: { id: jobId } }),
        onSettled: () => {
            invalidateQueue(queryClient)
            void queryClient.invalidateQueries({ queryKey: qk.scenes.all() })
        },
    })

    /** Requeues a failed job; it continues after the images it already saved. */
    const retry = useMutation({
        mutationFn: (jobId: number) => call(contract.jobs.retry, { params: { id: jobId } }),
        onSettled: () => invalidateQueue(queryClient),
    })

    return { start, stop, clearAll, remove, retry }
}
