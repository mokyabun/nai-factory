import type { QueueStatus } from '@nai-factory/shared'
import { AlertCircle, Loader, Pause, Play, Square, Trash2 } from 'lucide-react'

import {
    ImageProgressBar,
    imageTimingLabel,
    jobImageLabel,
    jobTargetLabel,
} from './generation-progress'
import { formatSeconds } from './generation-timing'
import { useGenerationStatus, useQueueActions } from './use-queue'

function StateLabel({ status }: { status: QueueStatus }) {
    switch (status.state) {
        case 'running':
            return (
                <>
                    <Loader className="h-3.5 w-3.5 animate-spin opacity-80 motion-reduce:animate-none" />
                    <span className="font-medium">생성 중</span>
                </>
            )
        case 'pausing':
            return (
                <>
                    <Loader className="h-3.5 w-3.5 animate-spin opacity-80 motion-reduce:animate-none" />
                    <span className="font-medium">현재 이미지 후 정지</span>
                </>
            )
        case 'paused':
            return status.pauseReason === 'failure' ? (
                <>
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span className="font-medium">실패로 정지됨</span>
                </>
            ) : (
                <>
                    <Pause className="h-3.5 w-3.5 opacity-80" />
                    <span className="opacity-80">일시정지</span>
                </>
            )
        case 'idle':
            return (
                <>
                    <span className="h-2 w-2 rounded-full bg-primary-foreground/30" />
                    <span className="opacity-70">대기</span>
                </>
            )
    }
}

const actionClassName =
    'flex h-full items-center gap-1.5 px-4 transition-colors hover:bg-primary-foreground/15 disabled:pointer-events-none disabled:opacity-50'

export function GenerationDock() {
    const { status, job, progress, remainingSeconds } = useGenerationStatus()
    const { start, stop, clearAll } = useQueueActions()
    const imageLabel = job ? jobImageLabel(job) : null

    return (
        <div className="relative flex h-10 shrink-0 items-center border-t bg-primary text-xs text-primary-foreground">
            {job && (
                <ImageProgressBar
                    progress={progress}
                    className="absolute inset-x-0 top-0 h-0.5"
                    fillClassName="bg-primary-foreground/80"
                />
            )}

            <output className="flex shrink-0 items-center gap-2 px-4">
                <StateLabel status={status} />
            </output>

            {job && (
                <>
                    <div className="hidden h-4 w-px shrink-0 bg-primary-foreground/20 sm:block" />
                    <div className="hidden min-w-0 items-center gap-2 px-4 sm:flex">
                        <span className="max-w-64 truncate font-medium">{jobTargetLabel(job)}</span>
                        {imageLabel && (
                            <span className="shrink-0 tabular-nums opacity-70">{imageLabel}</span>
                        )}
                        <span className="shrink-0 tabular-nums opacity-70">
                            {imageTimingLabel(progress)}
                        </span>
                    </div>
                </>
            )}

            {status.pendingCount > 0 && (
                <>
                    <div className="h-4 w-px shrink-0 bg-primary-foreground/20" />
                    <div className="flex shrink-0 items-center gap-1.5 px-4">
                        <span className="opacity-70">이미지</span>
                        <span className="font-semibold tabular-nums">{status.pendingImages}장</span>
                        <span className="opacity-70">남음</span>
                        {remainingSeconds !== null && (
                            <span className="hidden tabular-nums opacity-50 md:inline">
                                (약 {formatSeconds(remainingSeconds)})
                            </span>
                        )}
                    </div>
                </>
            )}

            <div className="flex-1" />

            <div className="flex h-full shrink-0 items-center divide-x divide-primary-foreground/20">
                {status.pendingCount > 0 && (
                    <button
                        type="button"
                        onClick={() => clearAll.mutate()}
                        disabled={clearAll.isPending}
                        className={actionClassName}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">전체 삭제</span>
                    </button>
                )}

                {status.state === 'running' ? (
                    <button
                        type="button"
                        onClick={() => stop.mutate()}
                        disabled={stop.isPending}
                        className={actionClassName}
                        title="현재 작업을 마친 뒤 정지합니다"
                    >
                        <Square className="h-3.5 w-3.5" />
                        정지
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => start.mutate()}
                        disabled={start.isPending || status.pendingCount === 0}
                        className={actionClassName}
                    >
                        <Play className="h-3.5 w-3.5" />
                        {status.state === 'pausing'
                            ? '계속'
                            : status.state === 'paused'
                              ? '재개'
                              : '시작'}
                    </button>
                )}
            </div>
        </div>
    )
}
