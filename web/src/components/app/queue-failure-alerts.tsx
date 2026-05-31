import { useQuery } from '@tanstack/react-query'
import { useSetAtom } from 'jotai'
import { AlertCircle, ListTodo, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { activeSidebarPanelAtom } from '@/components/app/sidebar/atom'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { api, type QueueHistoryEntry } from '@/lib/api'
import { qk } from '@/lib/queries'

type FailureNotice = Pick<
    QueueHistoryEntry,
    'id' | 'sceneName' | 'type' | 'prompt' | 'error' | 'completedAt'
>

const MAX_VISIBLE_ALERTS = 3

export function QueueFailureAlerts() {
    const setActivePanel = useSetAtom(activeSidebarPanelAtom)
    const mountedAt = useRef(Date.now())
    const seenIds = useRef(new Set<number>())
    const [notices, setNotices] = useState<FailureNotice[]>([])

    const statusQuery = useQuery({
        queryKey: qk.queueStatus(),
        queryFn: async () => {
            const { data } = await api.queue.status.get()
            return data ?? null
        },
    })

    useEffect(() => {
        const recent = statusQuery.data?.recent ?? []
        const freshFailures = recent.filter((entry) => {
            if (entry.status !== 'failed') return false
            if (seenIds.current.has(entry.id)) return false

            seenIds.current.add(entry.id)
            return new Date(entry.completedAt).getTime() >= mountedAt.current
        })

        if (freshFailures.length === 0) return

        setNotices((current) =>
            [
                ...freshFailures.map((entry) => ({
                    id: entry.id,
                    sceneName: entry.sceneName,
                    type: entry.type,
                    prompt: entry.prompt,
                    error: entry.error,
                    completedAt: entry.completedAt,
                })),
                ...current,
            ].slice(0, MAX_VISIBLE_ALERTS),
        )
    }, [statusQuery.data?.recent])

    useEffect(() => {
        if (notices.length === 0) return
        const timer = window.setTimeout(() => {
            setNotices((current) => current.slice(0, -1))
        }, 9000)

        return () => window.clearTimeout(timer)
    }, [notices])

    if (notices.length === 0) return null

    return (
        <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
            {notices.map((notice) => (
                <Alert
                    key={notice.id}
                    className="pointer-events-auto border-destructive/40 bg-background shadow-lg"
                >
                    <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
                    <AlertTitle className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate">생성 실패</span>
                        <button
                            type="button"
                            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
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
                                    {notice.type === 'playground'
                                        ? (notice.prompt ?? 'Playground')
                                        : notice.sceneName}
                                </div>
                                <div className="line-clamp-2 break-words">
                                    {notice.error ?? 'Unknown error'}
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 w-fit gap-1.5"
                                onClick={() => setActivePanel('queue')}
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
