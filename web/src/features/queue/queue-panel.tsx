import type { Job, QueueState } from '@nai-factory/shared'
import { useQuery } from '@tanstack/react-query'
import {
    BarChart3,
    Clock3,
    ListTodo,
    Loader,
    Play,
    RotateCcw,
    Square,
    Trash2,
    X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SidebarHeader } from '@/components/ui/sidebar'
import { queries } from '@/lib/queries'

import {
    ImageProgressBar,
    imageTimingLabel,
    jobImageLabel,
    jobTargetLabel,
} from './generation-progress'
import { formatSeconds } from './generation-timing'
import { useGenerationStatus, useJobHistory, useQueueActions } from './use-queue'

interface QueuePanelProps {
    projectId?: number | null
}

const stateLabels: Record<QueueState, string> = {
    running: '생성 중',
    pausing: '정지 대기',
    paused: '일시정지',
    idle: '대기',
}

const errorKindLabels: Record<NonNullable<Job['errorKind']>, string> = {
    config: '설정',
    auth: '인증',
    rate_limit: '요청 제한',
    network: '네트워크',
    prompt: '프롬프트',
    runtime: '오류',
}

function jobDurationMs(job: Job) {
    if (!job.startedAt || !job.finishedAt) return null
    return Math.max(0, Date.parse(job.finishedAt) - Date.parse(job.startedAt))
}

function progressLabel(job: Pick<Job, 'doneImages' | 'totalImages'>) {
    return job.totalImages !== null && job.totalImages > 1
        ? ` · ${job.doneImages}/${job.totalImages}`
        : ''
}

function formatDuration(milliseconds: number | null) {
    if (milliseconds === null) return '-'
    const seconds = Math.round(milliseconds / 1000)
    if (seconds >= 60) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    return `${seconds}s`
}

export function QueuePanel({ projectId }: QueuePanelProps) {
    const { status, job, progress, jobElapsedMs, remainingSeconds } = useGenerationStatus()
    const { start, stop, clearAll, remove, retry } = useQueueActions()

    const itemsQuery = useQuery(queries.jobs.list(projectId))
    const history = useJobHistory().data ?? []

    const items = (itemsQuery.data ?? []).filter((item) => item.status === 'queued')

    return (
        <div className="flex h-full min-h-0 flex-col bg-sidebar">
            <SidebarHeader className="border-b">
                <div className="flex min-w-0 items-center gap-2 px-1 py-1">
                    <ListTodo className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-md font-bold">Queue</span>
                    {status.state === 'running' ? (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1.5"
                            onClick={() => stop.mutate()}
                            disabled={stop.isPending}
                            title="현재 이미지를 마친 뒤 정지합니다"
                        >
                            <Square className="h-3.5 w-3.5" />
                            정지
                        </Button>
                    ) : (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1.5"
                            onClick={() => start.mutate()}
                            disabled={start.isPending || status.pendingCount === 0}
                        >
                            <Play className="h-3.5 w-3.5" />
                            {status.state === 'idle' ? '시작' : '재개'}
                        </Button>
                    )}
                </div>
            </SidebarHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2 scrollbar-none">
                <div className="grid grid-cols-2 gap-2">
                    <Metric
                        label="남은 작업 / 이미지"
                        value={`${status.pendingCount} / ${status.pendingImages}`}
                    />
                    <Metric
                        label="예상"
                        value={remainingSeconds !== null ? formatSeconds(remainingSeconds) : '-'}
                    />
                    <Metric
                        label={`이미지당 평균 (${status.sampleSize})`}
                        value={formatDuration(status.avgImageMs)}
                    />
                    <Metric
                        label="완료 / 실패"
                        value={`${status.completedCount} / ${status.failedCount}`}
                    />
                </div>

                <DurationChart entries={history} />

                <section className="rounded border bg-background/40 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-medium">
                            {status.state === 'running' || status.state === 'pausing' ? (
                                <Loader className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
                            ) : (
                                <Clock3 className="h-3.5 w-3.5" />
                            )}
                            처리 중
                        </div>
                        <Badge
                            variant={
                                status.pauseReason === 'failure'
                                    ? 'destructive'
                                    : status.state === 'running'
                                      ? 'secondary'
                                      : 'outline'
                            }
                        >
                            {status.pauseReason === 'failure'
                                ? '실패로 정지'
                                : stateLabels[status.state]}
                        </Badge>
                    </div>
                    {job ? (
                        <div className="flex flex-col gap-1.5 text-xs">
                            <div className="flex items-center gap-2">
                                <div className="min-w-0 flex-1 truncate font-medium">
                                    {jobTargetLabel(job)}
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 shrink-0 gap-1 px-1.5"
                                    onClick={() => remove.mutate(job.jobId)}
                                    disabled={remove.isPending}
                                    title="생성 중인 작업을 취소합니다"
                                >
                                    <X className="h-3.5 w-3.5" />
                                    취소
                                </Button>
                            </div>
                            <div className="truncate text-muted-foreground">
                                #{job.jobId} ·{' '}
                                {job.kind === 'playground'
                                    ? (job.prompt ?? 'prompt')
                                    : `variation ${job.variationId}`}
                            </div>
                            <ImageProgressBar
                                progress={progress}
                                className="h-1 rounded-full bg-muted"
                            />
                            <div className="flex items-center justify-between gap-2 text-muted-foreground tabular-nums">
                                <span>
                                    {[jobImageLabel(job), imageTimingLabel(progress)]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </span>
                                {jobElapsedMs !== null && (
                                    <span className="shrink-0">
                                        작업 {formatSeconds(jobElapsedMs / 1000)}
                                    </span>
                                )}
                            </div>
                            {status.state === 'pausing' && (
                                <div className="text-muted-foreground">
                                    이 이미지가 끝나면 정지합니다
                                </div>
                            )}
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
                                className="gap-1.5"
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
                                        {item.label || `Scene ${item.sceneId}`}
                                    </div>
                                    <div className="truncate text-[11px] text-muted-foreground">
                                        job #{item.id} ·{' '}
                                        {item.kind === 'playground'
                                            ? item.prompt
                                            : `variation ${item.variationId}`}
                                        {progressLabel(item)}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="relative shrink-0 text-muted-foreground transition-colors after:absolute after:-inset-2 hover:text-foreground"
                                    onClick={() => remove.mutate(item.id)}
                                    aria-label="대기열에서 삭제"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))
                    )}
                </section>

                <section className="flex flex-col gap-2">
                    <h3 className="text-xs font-medium">최근 결과</h3>
                    {history.length === 0 ? (
                        <div className="rounded border bg-background/40 p-3 text-xs text-muted-foreground">
                            기록 없음
                        </div>
                    ) : (
                        history.slice(0, 12).map((entry) => (
                            <div
                                key={entry.id}
                                className="flex items-center gap-2 rounded border bg-background/40 p-2 text-xs"
                            >
                                <Badge
                                    variant={
                                        entry.status === 'completed' ? 'secondary' : 'destructive'
                                    }
                                >
                                    {entry.status === 'completed'
                                        ? '완료'
                                        : entry.status === 'cancelled'
                                          ? '취소'
                                          : '실패'}
                                </Badge>
                                <div className="min-w-0 flex-1 truncate">
                                    <div className="truncate">
                                        {entry.kind === 'playground'
                                            ? (entry.prompt ?? 'Playground')
                                            : entry.label}
                                        {progressLabel(entry)}
                                    </div>
                                    {entry.status === 'failed' && entry.errorKind && (
                                        <div className="truncate text-[10px] text-muted-foreground">
                                            {errorKindLabels[entry.errorKind]}: {entry.error}
                                        </div>
                                    )}
                                </div>
                                {entry.status === 'failed' || entry.status === 'cancelled' ? (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 shrink-0 gap-1 px-1.5"
                                        onClick={() => retry.mutate(entry.id)}
                                        disabled={retry.isPending}
                                        title="남은 이미지를 이어서 생성합니다"
                                    >
                                        <RotateCcw className="h-3.5 w-3.5" />
                                        다시 시도
                                    </Button>
                                ) : (
                                    <span className="shrink-0 text-[11px] text-muted-foreground">
                                        {formatDuration(jobDurationMs(entry))}
                                    </span>
                                )}
                            </div>
                        ))
                    )}
                </section>
            </div>
        </div>
    )
}

function DurationChart({ entries }: { entries: Job[] }) {
    const samples = entries
        .filter((entry) => entry.status !== 'cancelled')
        .slice(0, 18)
        .reverse()
        .map((entry) => ({ ...entry, durationMs: jobDurationMs(entry) ?? 0 }))
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
