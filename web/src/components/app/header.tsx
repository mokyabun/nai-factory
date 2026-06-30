import { useQuery } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { Fragment } from 'react'
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { api } from '@/lib/api'
import { qk } from '@/lib/queries'

export function Header() {
    const pathname = useRouterState({ select: (s) => s.location.pathname })
    const statusQuery = useQuery({
        queryKey: qk.novelAIStatus(),
        queryFn: async () => {
            const { data } = await api.settings.novelai.status.get()
            return data ?? null
        },
        staleTime: 60_000,
        refetchInterval: 120_000,
    })

    const parts =
        pathname === '/'
            ? [{ key: '/', label: 'Home' }]
            : pathname
                .slice(1)
                .split('/')
                .reduce<Array<{ key: string; label: string }>>((items, part) => {
                    const parentKey = items.at(-1)?.key ?? ''

                    items.push({
                        key: `${parentKey}/${part}`,
                        label: part.charAt(0).toUpperCase() + part.slice(1),
                    })

                    return items
                }, [])

    return (
        <header className="sticky top-0 flex shrink-0 items-center gap-2 border-b bg-background p-4">
            <SidebarTrigger className="-ms-1" />
            <Separator orientation="vertical" className="me-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb className="min-w-0 flex-1">
                <BreadcrumbList>
                    {parts.map((part, index) => (
                        <Fragment key={part.key}>
                            <BreadcrumbItem>
                                <BreadcrumbLink href="#">{part.label}</BreadcrumbLink>
                            </BreadcrumbItem>
                            {index < parts.length - 1 && <BreadcrumbSeparator />}
                        </Fragment>
                    ))}
                </BreadcrumbList>
            </Breadcrumb>
            <AnlasStatus status={statusQuery.data ?? null} pending={statusQuery.isPending} />
        </header>
    )
}

function AnlasStatus({
    status,
    pending,
}: {
    status: Awaited<ReturnType<typeof api.settings.novelai.status.get>>['data']
    pending: boolean
}) {
    let label = 'Anlas -'
    let tone = 'border-border bg-background text-muted-foreground'

    if (pending) label = 'Anlas ...'
    else if (!status?.configured) label = 'API 키 없음'
    else if (status.error) {
        label = status.mode === 'fail' ? 'Anlas fail' : 'Anlas 오류'
        tone = 'border-destructive/30 bg-destructive/10 text-destructive'
    } else if (status.mode === 'mock') {
        label = `Anlas ${formatAnlas(status.anlas)} mock`
        tone = 'border-border bg-secondary text-secondary-foreground'
    } else if (status.unlimited) {
        label = 'Anlas 무제한'
        tone = 'border-border bg-secondary text-secondary-foreground'
    } else {
        label = `Anlas ${formatAnlas(status.anlas)}`
        tone = 'border-border bg-secondary text-secondary-foreground'
    }

    return (
        <div className={`shrink-0 rounded border px-2 py-1 font-mono text-[11px] ${tone}`}>
            {label}
        </div>
    )
}

function formatAnlas(value: number | null | undefined) {
    if (value === null || value === undefined) return '-'
    return value.toLocaleString()
}
