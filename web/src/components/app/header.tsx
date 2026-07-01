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
    const projectId = Number(pathname.match(/^\/project\/(\d+)/)?.[1] ?? NaN)
    const sceneId = Number(pathname.match(/^\/scene\/(\d+)/)?.[1] ?? NaN)
    const projectPathId = Number.isFinite(projectId) ? projectId : null
    const scenePathId = Number.isFinite(sceneId) ? sceneId : null

    const projectQuery = useQuery({
        queryKey: qk.project(projectPathId ?? 0),
        queryFn: async () => {
            if (projectPathId === null) return null
            const { data } = await api.projects({ projectId: projectPathId }).get()
            return data ?? null
        },
        enabled: projectPathId !== null,
    })
    const sceneQuery = useQuery({
        queryKey: qk.scene(scenePathId ?? 0),
        queryFn: async () => {
            if (scenePathId === null) return null
            const { data } = await api.scenes({ id: scenePathId }).get()
            return data ?? null
        },
        enabled: scenePathId !== null,
    })
    const sceneProjectId = sceneQuery.data?.projectId ?? null
    const sceneProjectQuery = useQuery({
        queryKey: qk.project(sceneProjectId ?? 0),
        queryFn: async () => {
            if (sceneProjectId === null) return null
            const { data } = await api.projects({ projectId: sceneProjectId }).get()
            return data ?? null
        },
        enabled: sceneProjectId !== null,
    })
    const statusQuery = useQuery({
        queryKey: qk.novelAIStatus(),
        queryFn: async () => {
            const { data } = await api.settings.novelai.status.get()
            return data ?? null
        },
        staleTime: 60_000,
        refetchInterval: 120_000,
    })

    const parts = createBreadcrumbParts({
        pathname,
        projectName: projectQuery.data?.name ?? null,
        sceneName: sceneQuery.data?.name ?? null,
        sceneProjectName: sceneProjectQuery.data?.name ?? null,
    })

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

function createBreadcrumbParts({
    pathname,
    projectName,
    sceneName,
    sceneProjectName,
}: {
    pathname: string
    projectName: string | null
    sceneName: string | null
    sceneProjectName: string | null
}) {
    if (pathname === '/') return [{ key: '/', label: 'Home' }]

    const segments = pathname.slice(1).split('/')
    const [root, id, child] = segments

    if (root === 'project' && id) {
        return [
            { key: '/project', label: 'Project' },
            { key: `/project/${id}`, label: projectName ?? `Project ${id}` },
        ]
    }

    if (root === 'scene' && id) {
        const parts = [
            { key: '/project', label: sceneProjectName ?? 'Project' },
            { key: `/scene/${id}`, label: sceneName ?? `Scene ${id}` },
        ]

        if (child === 'images') {
            parts.push({ key: `/scene/${id}/images`, label: 'Images' })
        }

        return parts
    }

    return segments.reduce<Array<{ key: string; label: string }>>((items, part) => {
        const parentKey = items.at(-1)?.key ?? ''

        items.push({
            key: `${parentKey}/${part}`,
            label: part.charAt(0).toUpperCase() + part.slice(1),
        })

        return items
    }, [])
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
