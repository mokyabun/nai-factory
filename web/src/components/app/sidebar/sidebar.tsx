import { useNavigate, useRouterState } from '@tanstack/react-router'
import { Provider, useAtom } from 'jotai'
import type { LucideIcon } from 'lucide-react'
import { AlignLeft, File, FlaskConical, ListTodo, Settings } from 'lucide-react'
import { type ComponentType, type LazyExoticComponent, lazy, Suspense, useEffect } from 'react'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import * as Base from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { activeSidebarPanelAtom, type SidebarPanel } from './atom'
import { SidebarFooter } from './sidebar-footer'
import { SidebarHeader } from './sidebar-header'

type PreloadablePanel<TProps = unknown> = LazyExoticComponent<ComponentType<TProps>> & {
    preload: () => Promise<{ default: ComponentType<TProps> }>
}

function lazyWithPreload<TProps = unknown>(
    load: () => Promise<{ default: ComponentType<TProps> }>,
): PreloadablePanel<TProps> {
    let promise: Promise<{ default: ComponentType<TProps> }> | null = null
    const loadOnce = () => {
        promise ??= load()
        return promise
    }

    return Object.assign(lazy(loadOnce), { preload: loadOnce })
}

const SidebarPlayground = lazyWithPreload<Record<string, never>>(() =>
    import('./playground').then((mod) => ({
        default: mod.SidebarPlayground as ComponentType<Record<string, never>>,
    })),
)
const SidebarProject = lazyWithPreload<Record<string, never>>(() =>
    import('./sidebar-project').then((mod) => ({
        default: mod.SidebarProject as ComponentType<Record<string, never>>,
    })),
)
const SidebarPrompt = lazyWithPreload<{ projectId: number | null }>(() =>
    import('./sidebar-prompt').then((mod) => ({
        default: mod.SidebarPrompt as ComponentType<{ projectId: number | null }>,
    })),
)
const SidebarQueue = lazyWithPreload<{ projectId?: number | null }>(() =>
    import('./sidebar-queue').then((mod) => ({
        default: mod.SidebarQueue as ComponentType<{ projectId?: number | null }>,
    })),
)
const SidebarSettings = lazyWithPreload<Record<string, never>>(() =>
    import('./sidebar-settings').then((mod) => ({
        default: mod.SidebarSettings as ComponentType<Record<string, never>>,
    })),
)

interface AppSidebarProps {
    projectId?: number | null
}

type SidebarItem = {
    title: string
    panel: SidebarPanel
    icon: LucideIcon
    to?: '/playground'
}

export function Sidebar({ projectId }: AppSidebarProps) {
    return (
        <Provider>
            <SidebarContent projectId={projectId} />
        </Provider>
    )
}

function SidebarContent({ projectId }: AppSidebarProps) {
    const { setOpen, open, isMobile, openMobile, setOpenMobile } = Base.useSidebar()
    const navigate = useNavigate()
    const [activePanel, setActivePanel] = useAtom(activeSidebarPanelAtom)

    const search = useRouterState({ select: (s) => s.location.search })
    const pathname = useRouterState({ select: (s) => s.location.pathname })

    useEffect(() => {
        SidebarProject.preload()
        SidebarQueue.preload()
    }, [])

    useEffect(() => {
        if (projectId) SidebarPrompt.preload()
    }, [projectId])

    useEffect(() => {
        const params = new URLSearchParams(search)
        const panel = params.get('sidebar') as SidebarPanel | null
        if (panel && ['project', 'playground', 'prompt', 'queue', 'settings'].includes(panel)) {
            preloadSidebarPanel(panel)
            setActivePanel(panel)
            return
        }
        if (pathname === '/playground') setActivePanel('playground')
        else if (activePanel === 'playground') {
            setActivePanel('project')
        }
    }, [search, pathname, activePanel, setActivePanel])

    const topItems: SidebarItem[] = [
        { title: '프로젝트', panel: 'project' as const, icon: File },
        {
            title: '프롬프트',
            panel: 'prompt' as const,
            icon: AlignLeft,
        },
        { title: 'Queue', panel: 'queue' as const, icon: ListTodo },
    ]
    const bottomItems = [
        {
            title: 'Playground',
            panel: 'playground' as const,
            icon: FlaskConical,
            to: '/playground',
        },
        { title: '설정', panel: 'settings' as const, icon: Settings },
    ]

    function handlePanelClick(panel: SidebarPanel, to?: '/playground') {
        preloadSidebarPanel(panel)

        if (to && pathname !== to) {
            navigate({ to })
            setActivePanel(panel)
            if (isMobile) setOpenMobile(true)
            else setOpen(true)
            return
        }

        if (activePanel === panel) {
            if (isMobile) setOpenMobile(!openMobile)
            else setOpen(!open)
        } else {
            setActivePanel(panel)
            if (isMobile) setOpenMobile(true)
            else setOpen(true)
            const url = new URL(window.location.href)
            url.searchParams.set('sidebar', panel)
            window.history.replaceState(null, '', url.toString())
        }
    }

    function renderIconRail(mobile = false) {
        return (
            <>
                <SidebarHeader />
                <Base.SidebarContent>
                    <Base.SidebarGroup className="h-full">
                        <Base.SidebarGroupContent className="h-full px-1.5 md:px-0">
                            <Base.SidebarMenu className="flex h-full flex-col">
                                {topItems.map((item) => (
                                    <Base.SidebarMenuItem key={item.title}>
                                        <Base.SidebarMenuButton
                                            tooltip={item.title}
                                            onMouseEnter={() => preloadSidebarPanel(item.panel)}
                                            onFocus={() => preloadSidebarPanel(item.panel)}
                                            onClick={() => handlePanelClick(item.panel, item.to)}
                                            isActive={activePanel === item.panel}
                                            className={
                                                mobile
                                                    ? 'h-10 justify-center px-2.5 [&>span]:sr-only'
                                                    : 'px-2.5 md:px-2'
                                            }
                                        >
                                            <item.icon />
                                            <span>{item.title}</span>
                                        </Base.SidebarMenuButton>
                                    </Base.SidebarMenuItem>
                                ))}
                                <div className="mt-auto">
                                    {bottomItems.map((item) => (
                                        <Base.SidebarMenuItem key={item.title}>
                                            <Base.SidebarMenuButton
                                                tooltip={item.title}
                                                onMouseEnter={() => preloadSidebarPanel(item.panel)}
                                                onFocus={() => preloadSidebarPanel(item.panel)}
                                                onClick={() =>
                                                    handlePanelClick(item.panel, item.to)
                                                }
                                                isActive={activePanel === item.panel}
                                                className={
                                                    mobile
                                                        ? 'h-10 justify-center px-2.5 [&>span]:sr-only'
                                                        : 'px-2.5 md:px-2'
                                                }
                                            >
                                                <item.icon />
                                                <span>{item.title}</span>
                                            </Base.SidebarMenuButton>
                                        </Base.SidebarMenuItem>
                                    ))}
                                </div>
                            </Base.SidebarMenu>
                        </Base.SidebarGroupContent>
                    </Base.SidebarGroup>
                </Base.SidebarContent>
                <SidebarFooter />
            </>
        )
    }

    function renderPanel() {
        return (
            <Suspense fallback={<SidebarPanelFallback />}>
                {activePanel === 'project' && <SidebarProject />}
                {activePanel === 'playground' && <SidebarPlayground />}
                {activePanel === 'prompt' && <SidebarPrompt projectId={projectId ?? null} />}
                {activePanel === 'queue' && <SidebarQueue projectId={projectId} />}
                {activePanel === 'settings' && <SidebarSettings />}
            </Suspense>
        )
    }

    if (isMobile) {
        return (
            <Sheet open={openMobile} onOpenChange={setOpenMobile}>
                <SheetContent
                    side="left"
                    showCloseButton={false}
                    className="!w-[min(100vw,28rem)] !max-w-none bg-sidebar p-0 text-sidebar-foreground"
                >
                    <SheetHeader className="sr-only">
                        <SheetTitle>Sidebar</SheetTitle>
                        <SheetDescription>Displays the mobile sidebar.</SheetDescription>
                    </SheetHeader>
                    <div className="flex h-full min-h-0 w-full">
                        <div className="flex w-[calc(var(--sidebar-width-icon)_+_1px)] shrink-0 flex-col border-e [&_[data-sidebar=menu-button]>div:last-child]:sr-only">
                            {renderIconRail(true)}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col">{renderPanel()}</div>
                    </div>
                </SheetContent>
            </Sheet>
        )
    }

    return (
        <Base.Sidebar
            collapsible="icon"
            className="overflow-hidden [&>[data-sidebar=sidebar]]:flex-row"
        >
            {/* Icon rail */}
            <Base.Sidebar
                collapsible="none"
                className="!w-[calc(var(--sidebar-width-icon)_+_1px)] border-e"
            >
                {renderIconRail()}
            </Base.Sidebar>

            {/* Panel */}
            <Base.Sidebar collapsible="none" className="hidden min-w-0 flex-1 !w-auto md:flex">
                {renderPanel()}
                <Base.SidebarRail />
            </Base.Sidebar>
        </Base.Sidebar>
    )
}

function preloadSidebarPanel(panel: SidebarPanel) {
    if (panel === 'project') SidebarProject.preload()
    if (panel === 'playground') SidebarPlayground.preload()
    if (panel === 'prompt') SidebarPrompt.preload()
    if (panel === 'queue') SidebarQueue.preload()
    if (panel === 'settings') SidebarSettings.preload()
}

function SidebarPanelFallback() {
    return (
        <div className="flex flex-1 flex-col">
            <div className="flex h-10 shrink-0 items-center gap-2 border-b px-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-36" />
            </div>
            <div className="flex flex-col gap-3 p-3">
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-10 w-3/4" />
            </div>
        </div>
    )
}
