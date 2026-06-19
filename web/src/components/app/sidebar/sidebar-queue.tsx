import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, Clock3, ListTodo, Loader, Play, Square, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SidebarHeader } from '@/components/ui/sidebar'
import { api, type QueueStatus } from '@/lib/api'
import { qk } from '@/lib/queries'

interface SidebarQueueProps {
    projectId?: number | null
}

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

function formatDuration(milliseconds: number | null) {
    if (milliseconds === null) return '-'
    const seconds = Math.round(milliseconds / 1000)
    if (seconds >= 60) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    return `${seconds}s`
}

function formatSeconds(seconds: number | null) {
    if (seconds === null) return '-'
    if (seconds >= 60) return `${Math.ceil(seconds / 60)}분`
    return `${seconds}초`
}

export function SidebarQueue({ projectId }: SidebarQueueProps) {
    const queryClient = useQueryClient()

    const statusQuery = useQuery({
        queryKey: qk.queueStatus(),
        queryFn: async () => {
            const { data } = await api.queue.status.get()
            return data ?? emptyStatus
        },
    })

    const itemsQuery = useQuery({
        queryKey: qk.queue(projectId),
        queryFn: async () => {
            const { data } = await api.queue.get({
                query: projectId ? { projectId } : undefined,
            })
            return data ?? []
        },
    })

    const invalidateQueue = () => {
        queryClient.invalidateQueries({ queryKey: qk.queueStatus() })
        queryClient.invalidateQueries({ queryKey: qk.queue(projectId) })
    }

    const startQueue = useMutation({
        mutationFn: () => api.queue.start.post(),
        onSuccess: invalidateQueue,
    })

    const stopQueue = useMutation({
        mutationFn: () => api.queue.stop.post(),
        onSuccess: invalidateQueue,
    })

    const clearAll = useMutation({
        mutationFn: () => api.queue.delete(),
        onSuccess: invalidateQueue,
    })

    const status = statusQuery.data ?? emptyStatus
    const items = itemsQuery.data ?? []

    return (
        <div className="flex h-full min-h-0 flex-col bg-sidebar">
            <SidebarHeader className="border-b">
                <div className="flex min-w-0 items-center gap-2 px-1 py-1">
                    <ListTodo className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-md font-bold">Queue</span>
                    {status.running ? (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1.5"
                            onClick={() => stopQueue.mutate()}
                        >
                            <Square className="h-3.5 w-3.5" />
                            정지
                        </Button>
                    ) : (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1.5"
                            onClick={() => startQueue.mutate()}
                        >
                            <Play className="h-3.5 w-3.5" />
                            시작
                        </Button>
                    )}
                </div>
            </SidebarHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2 scrollbar-none">
                <div className="grid grid-cols-2 gap-2">
                    <Metric label="남음" value={`${status.pendingCount}`} />
                    <Metric label="예상" value={formatSeconds(status.estimatedSeconds)} />
                    <Metric
                        label={`평균 ${status.durationSampleSize}`}
                        value={formatDuration(status.avgDurationMs)}
                    />
                    <Metric
                        label="완료 / 실패"
                        value={`${status.completedCount} / ${status.failedCount}`}
                    />
                </div>

                <DurationChart entries={status.recent} />

                <section className="rounded border bg-background/40 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-medium">
                            {status.processing ? (
                                <Loader className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Clock3 className="h-3.5 w-3.5" />
                            )}
                            처리 중
                        </div>
                        <Badge variant={status.running ? 'secondary' : 'outline'}>
                            {status.running ? 'running' : 'stopped'}
                        </Badge>
                    </div>
                    {status.currentJob ? (
                        <div className="flex flex-col gap-1 text-xs">
                            <div className="truncate font-medium">
                                {status.currentJob.type === 'playground'
                                    ? 'Playground'
                                    : status.currentJob.sceneName}
                            </div>
                            <div className="text-muted-foreground">
                                #{status.currentJob.id} ·{' '}
                                {status.currentJob.type === 'playground'
                                    ? (status.currentJob.prompt ?? 'prompt')
                                    : `variation ${status.currentJob.sceneVariationId}`}{' '}
                                · {status.currentJob.elapsedSeconds}s
                            </div>
                        </div>
                    ) : (
                        <div className="text-xs text-muted-foreground">대기 중</div>
                    )}
                </section>

                <section className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-medium">대기열</h3>
                        {items.length > 0 && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1.5 text-xs"
                                onClick={() => clearAll.mutate()}
                                disabled={clearAll.isPending}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                전체 삭제
                            </Button>
                        )}
                    </div>
                    {items.length === 0 ? (
                        <div className="rounded border bg-background/40 p-3 text-xs text-muted-foreground">
                            비어 있음
                        </div>
                    ) : (
                        items.map((item, index) => (
                            <div
                                key={item.id}
                                className="flex items-center gap-2 rounded border bg-background/40 p-2 text-xs"
                            >
                                <span className="w-6 shrink-0 text-right font-mono text-muted-foreground">
                                    {index + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="truncate font-medium">
                                        {item.type === 'playground'
                                            ? 'Playground'
                                            : (item.sceneName ?? `Scene ${item.sceneId}`)}
                                    </div>
                                    <div className="truncate text-[11px] text-muted-foreground">
                                        job #{item.id} ·{' '}
                                        {item.type === 'playground'
                                            ? item.prompt
                                            : `variation ${item.sceneVariationId}`}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </section>

                <section className="flex flex-col gap-2">
                    <h3 className="text-xs font-medium">최근 결과</h3>
                    {status.recent.length === 0 ? (
                        <div className="rounded border bg-background/40 p-3 text-xs text-muted-foreground">
                            기록 없음
                        </div>
                    ) : (
                        status.recent.slice(0, 12).map((entry) => (
                            <div
                                key={entry.id}
                                className="flex items-center gap-2 rounded border bg-background/40 p-2 text-xs"
                            >
                                <Badge
                                    variant={
                                        entry.status === 'completed' ? 'secondary' : 'destructive'
                                    }
                                >
                                    {entry.status === 'completed' ? '완료' : '실패'}
                                </Badge>
                                <div className="min-w-0 flex-1 truncate">
                                    <div className="truncate">
                                        {entry.type === 'playground'
                                            ? (entry.prompt ?? 'Playground')
                                            : entry.sceneName}
                                    </div>
                                    {entry.status === 'failed' && entry.failureCategory && (
                                        <div className="truncate text-[10px] text-muted-foreground">
                                            {entry.failureCategory}: {entry.error}
                                        </div>
                                    )}
                                </div>
                                <span className="shrink-0 text-[11px] text-muted-foreground">
                                    {formatDuration(entry.durationMs)}
                                </span>
                            </div>
                        ))
                    )}
                </section>
            </div>
        </div>
    )
}

function DurationChart({ entries }: { entries: QueueStatus['recent'] }) {
    const samples = [...entries].slice(0, 18).reverse()
    const maxDuration = Math.max(1, ...samples.map((entry) => entry.durationMs))

    return (
        <section className="rounded border bg-background/40 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium">
                <BarChart3 className="h-3.5 w-3.5" />
                최근 생성 시간
            </div>
            {samples.length === 0 ? (
                <div className="text-xs text-muted-foreground">기록 없음</div>
            ) : (
                <div className="flex h-16 items-end gap-1">
                    {samples.map((entry) => (
                        <div
                            key={entry.id}
                            title={`${entry.status} · ${formatDuration(entry.durationMs)}`}
                            className={[
                                'min-w-0 flex-1 rounded-t',
                                entry.status === 'failed' ? 'bg-destructive/70' : 'bg-primary/70',
                            ].join(' ')}
                            style={{
                                height: `${Math.max(8, (entry.durationMs / maxDuration) * 100)}%`,
                            }}
                        />
                    ))}
                </div>
            )}
        </section>
    )
}

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded border bg-background/40 p-2">
            <div className="truncate text-[11px] text-muted-foreground">{label}</div>
            <div className="mt-1 truncate font-mono text-sm font-semibold">{value}</div>
        </div>
    )
}
