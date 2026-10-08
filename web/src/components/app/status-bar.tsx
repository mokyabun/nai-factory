import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader, Play, Square, Trash2 } from 'lucide-react'

import { api, type QueueStatus, type SceneSummary } from '@/lib/api'
import {
    requireApiResult,
    restoreSnapshot,
    restoreSnapshots,
    snapshotQueries,
    snapshotQuery,
} from '@/lib/optimistic'
import { qk } from '@/lib/queries'

const emptyStatus: QueueStatus = {
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
}

export function StatusBar() {
    const queryClient = useQueryClient()

    const statusQuery = useQuery({
        queryKey: qk.queueStatus(),
        queryFn: async () => {
            const { data } = await api.queue.status.get()
            return data ?? emptyStatus
        },
    })

    const startQueue = useMutation({
        mutationFn: () => requireApiResult(api.queue.start.post()),
        onMutate: async () => {
            const previousStatus = await snapshotQuery<QueueStatus>(queryClient, qk.queueStatus())
            queryClient.setQueryData<QueueStatus>(qk.queueStatus(), (status) => ({
                ...(status ?? emptyStatus),
                running: true,
            }))
            return { previousStatus }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshot(queryClient, context?.previousStatus)
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: qk.queueStatus() }),
    })

    const stopQueue = useMutation({
        mutationFn: () => requireApiResult(api.queue.stop.post()),
        onMutate: async () => {
            const previousStatus = await snapshotQuery<QueueStatus>(queryClient, qk.queueStatus())
            queryClient.setQueryData<QueueStatus>(qk.queueStatus(), (status) => ({
                ...(status ?? emptyStatus),
                running: false,
            }))
            return { previousStatus }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshot(queryClient, context?.previousStatus)
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: qk.queueStatus() }),
    })

    const clearAll = useMutation({
        mutationFn: () => requireApiResult(api.queue.delete()),
        onMutate: async () => {
            const snapshots = await snapshotQueries(queryClient, {
                predicate: (query) =>
                    query.queryKey[0] === 'queue' ||
                    (query.queryKey[0] === 'scenes' && typeof query.queryKey[1] === 'number'),
            })
            queryClient.setQueryData<QueueStatus>(qk.queueStatus(), (status) => ({
                ...(status ?? emptyStatus),
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
                (scenes) =>
                    scenes?.map((scene) => ({
                        ...scene,
                        queueCount: 0,
                    })),
            )
            return { snapshots }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshots(queryClient, context?.snapshots)
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: qk.queueStatus() })
            void queryClient.invalidateQueries({
                predicate: (query) =>
                    query.queryKey[0] === 'queue' && query.queryKey[1] === 'items',
            })
        },
    })

    const status = statusQuery.data ?? emptyStatus

    return (
        <div className="flex h-10 shrink-0 items-center border-t bg-primary text-xs text-primary-foreground">
            {/* Status indicator */}
            <div className="flex items-center gap-2 px-4">
                {status.running ? (
                    <>
                        {status.processing ? (
                            <Loader className="h-3.5 w-3.5 animate-spin opacity-80" />
                        ) : (
                            <span className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_6px_1px_#4ade80]" />
                        )}
                        <span className="font-medium">
                            {status.processing ? '생성 중' : '실행 중'}
                        </span>
                    </>
                ) : (
                    <>
                        <span className="h-2 w-2 rounded-full bg-primary-foreground/30" />
                        <span className="opacity-70">정지됨</span>
                    </>
                )}
            </div>

            <div className="h-4 w-px bg-primary-foreground/20" />

            {/* Queue count */}
            <div className="flex items-center gap-1.5 px-4">
                <span className="font-semibold tabular-nums">{status.pendingCount}개</span>
                <span className="opacity-70">남음</span>
                {status.estimatedSeconds !== null && status.pendingCount > 0 && (
                    <span className="opacity-50">
                        (예상{' '}
                        {status.estimatedSeconds >= 60
                            ? `${Math.ceil(status.estimatedSeconds / 60)}분`
                            : `${status.estimatedSeconds}초`}
                        )
                    </span>
                )}
            </div>

            <div className="flex-1" />

            {/* Actions */}
            <div className="flex h-full items-center divide-x divide-primary-foreground/20">
                {status.pendingCount > 0 && (
                    <button
                        type="button"
                        onClick={() => clearAll.mutate()}
                        disabled={clearAll.isPending}
                        className="flex h-full items-center gap-1.5 px-4 transition-colors hover:bg-primary-foreground/15 disabled:opacity-50"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        전체 삭제
                    </button>
                )}

                {status.running ? (
                    <button
                        type="button"
                        onClick={() => stopQueue.mutate()}
                        className="flex h-full items-center gap-1.5 px-4 transition-colors hover:bg-primary-foreground/15"
                    >
                        <Square className="h-3.5 w-3.5" />
                        정지
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => startQueue.mutate()}
                        className="flex h-full items-center gap-1.5 px-4 transition-colors hover:bg-primary-foreground/15"
                    >
                        <Play className="h-3.5 w-3.5" />
                        시작
                    </button>
                )}
            </div>
        </div>
    )
}
