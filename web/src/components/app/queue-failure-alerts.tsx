import type { Job } from '@nai-factory/shared'
import { useNavigate } from '@tanstack/react-router'
import { AlertCircle, ListTodo, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/ui/sidebar'
import { useJobHistory } from '@/hooks/use-queue'

type FailureNotice = Pick<Job, 'id' | 'label' | 'kind' | 'prompt' | 'error'>

const MAX_VISIBLE_ALERTS = 3

export function QueueFailureAlerts() {
    const navigate = useNavigate()
    const { isMobile, setOpen, setOpenMobile } = useSidebar()
    // eslint-disable-next-line react/purity -- Capture the mount timestamp once to filter older failure events.
    const mountedAt = useRef(Date.now())
    const seenIds = useRef(new Set<number>())
    const [notices, setNotices] = useState<FailureNotice[]>([])

    const { data: history } = useJobHistory()

    useEffect(() => {
        const freshFailures = (history ?? []).filter((job) => {
            if (job.status !== 'failed' || !job.finishedAt) return false
            if (seenIds.current.has(job.id)) return false

            seenIds.current.add(job.id)
            return new Date(job.finishedAt).getTime() >= mountedAt.current
        })

        if (freshFailures.length === 0) return

        setNotices((current) =>
            [
                ...freshFailures.map((job) => ({
                    id: job.id,
                    label: job.label,
                    kind: job.kind,
                    prompt: job.prompt,
                    error: job.error,
                })),
                ...current,
            ].slice(0, MAX_VISIBLE_ALERTS),
        )
    }, [history])

    useEffect(() => {
        if (notices.length === 0) return
        const timer = window.setTimeout(() => {
            setNotices((current) => current.slice(0, -1))
        }, 9000)

        return () => window.clearTimeout(timer)
    }, [notices])

    // The sidebar follows `?sidebar=`, so the panel switches without leaving the current page.
    function showQueue() {
        void navigate({ to: '.', search: (prev) => ({ ...prev, sidebar: 'queue' }) })
        if (isMobile) setOpenMobile(true)
        else setOpen(true)
    }

    if (notices.length === 0) return null

    return (
        <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
            {notices.map((notice) => (
                <Alert
                    key={notice.id}
                    className="pointer-events-auto border-destructive/40 bg-background shadow-lg *:[svg]:text-destructive"
                >
                    <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
                    <AlertTitle className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate">생성 실패</span>
                        <button
                            type="button"
                            className="relative shrink-0 text-muted-foreground transition-colors after:absolute after:-inset-2 hover:text-foreground"
                            onClick={() =>
                                setNotices((current) =>
                                    current.filter((item) => item.id !== notice.id),
                                )
                            }
                            aria-label="알림 닫기"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </AlertTitle>
                    <AlertDescription>
                        <div className="flex min-w-0 flex-col gap-2">
                            <div className="min-w-0">
                                <div className="truncate font-medium text-foreground">
                                    {notice.kind === 'playground'
                                        ? (notice.prompt ?? 'Playground')
                                        : notice.label}
                                </div>
                                <div className="line-clamp-2 break-words">
                                    {notice.error ?? 'Unknown error'}
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-fit gap-1.5"
                                onClick={showQueue}
                            >
                                <ListTodo className="h-3.5 w-3.5" />
                                Queue 보기
                            </Button>
                        </div>
                    </AlertDescription>
                </Alert>
            ))}
        </div>
    )
}
