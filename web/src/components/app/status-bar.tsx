import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader, Play, Square, Trash2 } from 'lucide-react'
import { api } from '#/lib/api'
import { qk } from '#/lib/queries'

export function StatusBar() {
    const queryClient = useQueryClient()

    const statusQuery = useQuery({
        queryKey: qk.queueStatus(),
        queryFn: async () => {
            const { data } = await api.queue.status.get()
            return (
                data ?? {
                    running: false,
                    processing: false,
                    pendingCount: 0,
                    estimatedSeconds: null,
                    currentSceneId: null as number | null,
                }
            )
        },
    })

    const startQueue = useMutation({
        mutationFn: () => api.queue.start.post(),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.queueStatus() }),
    })

    const stopQueue = useMutation({
        mutationFn: () => api.queue.stop.post(),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.queueStatus() }),
    })

    const clearAll = useMutation({
        mutationFn: () => api.queue.delete(),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.queueStatus() }),
    })

    const status = statusQuery.data ?? {
        running: false,
        processing: false,
        pendingCount: 0,
        estimatedSeconds: null as number | null,
        currentSceneId: null as number | null,
    }

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
