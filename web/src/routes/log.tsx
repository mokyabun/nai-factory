import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Bug, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api, type DebugRequestEntry } from '@/lib/api'
import { qk } from '@/lib/queries'

export const Route = createFileRoute('/log')({ component: LogPage })

function LogPage() {
    const queryClient = useQueryClient()
    const requestsQuery = useQuery({
        queryKey: qk.debugRequests(),
        queryFn: async () => {
            const { data } = await api.debug.requests.get()
            return data ?? []
        },
    })
    const clearRequests = useMutation({
        mutationFn: () => api.debug.requests.delete(),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.debugRequests() }),
    })
    const requests = requestsQuery.data ?? []

    return (
        <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col gap-4 p-2">
            <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <Bug className="h-4 w-4 shrink-0" />
                    <h1 className="truncate text-xl font-bold">Log</h1>
                    <span className="text-xs text-muted-foreground">{requests.length}개</span>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={clearRequests.isPending || requests.length === 0}
                    onClick={() => clearRequests.mutate()}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                    전체 삭제
                </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
                {requestsQuery.isPending ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        불러오는 중...
                    </div>
                ) : requests.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        기록 없음
                    </div>
                ) : (
                    <div className="flex flex-col gap-2 pb-4">
                        {requests.map((request) => (
                            <LogRequestRow key={request.id} request={request} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

function LogRequestRow({ request }: { request: DebugRequestEntry }) {
    const [open, setOpen] = useState(false)
    const statusVariant =
        request.status === 'success'
            ? 'secondary'
            : request.status === 'error'
              ? 'destructive'
              : 'outline'

    return (
        <div className="rounded border bg-card">
            <button
                type="button"
                className="flex w-full items-center gap-2 p-3 text-left"
                onClick={() => setOpen((value) => !value)}
            >
                <Badge variant={statusVariant} className="shrink-0">
                    {request.status}
                </Badge>
                <span className="min-w-0 flex-1 truncate font-mono text-xs">
                    {request.method} {request.url.replace('https://image.novelai.net/ai/', '')}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatDuration(request.durationMs)}
                </span>
                <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">
                    {formatDate(request.createdAt)}
                </span>
            </button>
            {open && (
                <div className="border-t p-3">
                    <pre className="max-h-[34rem] overflow-auto rounded bg-muted p-3 text-[11px] leading-relaxed">
                        {JSON.stringify(
                            {
                                context: request.context,
                                request: request.request,
                                response: request.response,
                                error: request.error,
                            },
                            null,
                            2,
                        )}
                    </pre>
                </div>
            )}
        </div>
    )
}

function formatDuration(milliseconds: number | null) {
    if (milliseconds === null) return '-'
    if (milliseconds >= 1000) return `${(milliseconds / 1000).toFixed(1)}s`
    return `${milliseconds}ms`
}

function formatDate(value: string) {
    return new Date(value).toLocaleString()
}
