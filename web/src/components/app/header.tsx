import type { NovelAIAccountStatus } from '@nai-factory/shared'
import { useQuery } from '@tanstack/react-query'
import { Link, type LinkOptions, useRouterState } from '@tanstack/react-router'
import { Fragment } from 'react'

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { call, contract } from '@/lib/api'
import { qk } from '@/lib/queries'

export function Header() {
    const pathname = useRouterState({ select: (s) => s.location.pathname })
    const projectId = Number(pathname.match(/^\/project\/(\d+)/)?.[1] ?? NaN)
    const sceneId = Number(pathname.match(/^\/scene\/(\d+)/)?.[1] ?? NaN)
    const projectPathId = Number.isFinite(projectId) ? projectId : null
    const scenePathId = Number.isFinite(sceneId) ? sceneId : null

    const projectQuery = useQuery({
        queryKey: qk.projects.get(projectPathId ?? 0),
        queryFn: () => call(contract.projects.get, { params: { id: projectPathId as number } }),
        enabled: projectPathId !== null,
    })
    const sceneQuery = useQuery({
        queryKey: qk.scenes.get(scenePathId ?? 0),
        queryFn: () => call(contract.scenes.get, { params: { id: scenePathId as number } }),
        enabled: scenePathId !== null,
    })
    const sceneProjectId = sceneQuery.data?.projectId ?? null
    const sceneProjectQuery = useQuery({
        queryKey: qk.projects.get(sceneProjectId ?? 0),
        queryFn: () => call(contract.projects.get, { params: { id: sceneProjectId as number } }),
        enabled: sceneProjectId !== null,
    })
    // No polling: generations and NovelAI settings changes refresh it through realtime events.
    const statusQuery = useQuery({
        queryKey: qk.settings.novelAIStatus(),
        queryFn: () => call(contract.settings.novelAIStatus),
        staleTime: 5 * 60_000,
    })

    const parts = createBreadcrumbParts({
        pathname,
        projectName: projectQuery.data?.name ?? null,
        sceneName: sceneQuery.data?.name ?? null,
        sceneProjectId,
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
                                {part.link && part.key !== pathname ? (
                                    <BreadcrumbLink render={<Link {...part.link} />}>
                                        {part.label}
                                    </BreadcrumbLink>
                                ) : index === parts.length - 1 ? (
                                    <BreadcrumbPage>{part.label}</BreadcrumbPage>
                                ) : (
                                    <span>{part.label}</span>
                                )}
                            </BreadcrumbItem>
                            {index < parts.length - 1 && <BreadcrumbSeparator />}
                        </Fragment>
                    ))}
                </BreadcrumbList>
            </Breadcrumb>
            <AnlasStatus status={statusQuery.data} pending={statusQuery.isPending} />
        </header>
    )
}

type BreadcrumbPart = {
    /** The path the part stands for; a part whose path is the current page is not linked. */
    key: string
    label: string
    link?: LinkOptions
}

function createBreadcrumbParts({
    pathname,
    projectName,
    sceneName,
    sceneProjectId,
    sceneProjectName,
}: {
    pathname: string
    projectName: string | null
    sceneName: string | null
    sceneProjectId: number | null
    sceneProjectName: string | null
}): BreadcrumbPart[] {
    if (pathname === '/') return [{ key: '/', label: 'Home' }]

    const segments = pathname.slice(1).split('/')
    const [root, id, child] = segments

    if (root === 'project' && id) {
        return [
            { key: '/project', label: 'Project' },
            {
                key: `/project/${id}`,
                label: projectName ?? `Project ${id}`,
                link: { to: '/project/$projectId', params: { projectId: id } },
            },
        ]
    }

    if (root === 'scene' && id) {
        const parts: BreadcrumbPart[] = [
            sceneProjectId === null
                ? { key: '/project', label: 'Project' }
                : {
                      key: `/project/${sceneProjectId}`,
                      label: sceneProjectName ?? 'Project',
                      link: {
                          to: '/project/$projectId',
                          params: { projectId: String(sceneProjectId) },
                      },
                  },
            {
                key: `/scene/${id}`,
                label: sceneName ?? `Scene ${id}`,
                link: { to: '/scene/$sceneId', params: { sceneId: id } },
            },
        ]

        if (child === 'images') {
            parts.push({
                key: `/scene/${id}/images`,
                label: 'Images',
                link: { to: '/scene/$sceneId/images', params: { sceneId: id } },
            })
        }

        return parts
    }

    return segments.reduce<BreadcrumbPart[]>((items, part) => {
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
    status: NovelAIAccountStatus | undefined
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
