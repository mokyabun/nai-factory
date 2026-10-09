import type { QueueCurrentJob } from '@nai-factory/shared'

import { cn } from '@/lib/utils'

import { formatSeconds, type ImageProgress } from './generation-timing'

export function jobTargetLabel(job: QueueCurrentJob) {
    return job.label
}

/** "이미지 2/5" for the image currently generating; null for single-image or uncompiled jobs. */
export function jobImageLabel(job: Pick<QueueCurrentJob, 'total' | 'done'>) {
    if (job.total === null || job.total <= 1) return null

    const current = Math.min(job.done + 1, job.total)
    return `이미지 ${current}/${job.total}`
}

/** "12초 / 약 20초", or a preparation/estimation notice when timing is not available yet. */
export function imageTimingLabel(progress: ImageProgress | null) {
    if (!progress) return '준비 중'

    const elapsed = formatSeconds(progress.elapsedMs / 1000)
    if (progress.estimateMs === null) return `${elapsed} · 시간 추정 중`
    if (progress.overrun) return `${elapsed} · 예상보다 오래 걸림`

    return `${elapsed} / 약 ${formatSeconds(progress.estimateMs / 1000)}`
}

interface ImageProgressBarProps {
    progress: ImageProgress | null
    className?: string
    fillClassName?: string
}

/**
 * Estimated progress of the image currently generating. NovelAI reports no real progress, so this
 * fills over the average image duration and holds short of full until the image is saved.
 */
export function ImageProgressBar({ progress, className, fillClassName }: ImageProgressBarProps) {
    const ratio = progress?.ratio ?? null
    const indeterminate = ratio === null || progress?.overrun === true

    return (
        <div className={cn('overflow-hidden', className)} aria-hidden>
            <div
                // A new element per image starts the next bar from zero instead of animating back.
                key={progress?.startedAt ?? 'waiting'}
                className={cn(
                    'h-full bg-primary',
                    indeterminate
                        ? 'animate-pulse motion-reduce:animate-none'
                        : 'transition-[width] duration-1000 ease-linear motion-reduce:transition-none',
                    ratio === null && 'opacity-40',
                    fillClassName,
                )}
                style={{ width: ratio === null ? '100%' : `${ratio * 100}%` }}
            />
        </div>
    )
}
