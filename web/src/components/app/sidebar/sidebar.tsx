import { useRouterState } from '@tanstack/react-router'
import { AlignLeft, File, ListTodo, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import * as Base from '@/components/ui/sidebar'
import { SidebarFooter } from './sidebar-footer'
import { SidebarHeader } from './sidebar-header'
import { SidebarProject } from './sidebar-project'
import { SidebarPrompt } from './sidebar-prompt'
import { SidebarQueue } from './sidebar-queue'
import { SidebarSettings } from './sidebar-settings'

interface AppSidebarProps {
    projectId?: number | null
}

type SidebarPanel = 'project' | 'prompt' | 'queue' | 'settings'

export function Sidebar({ projectId }: AppSidebarProps) {
    const { setOpen, open } = Base.useSidebar()

    const [activePanel, setActivePanel] = useState<SidebarPanel>('project')

    const search = useRouterState({ select: (s) => s.location.search })

    // Sync panel from URL search param
    useEffect(() => {
        const params = new URLSearchParams(search)
        const panel = params.get('sidebar') as SidebarPanel | null
        if (panel && ['project', 'prompt', 'queue', 'settings'].includes(panel)) {
            setActivePanel(panel)
        }
    }, [search])

    const topItems = [
        { title: '프로젝트', panel: 'project' as const, icon: File },
        ...(projectId ? [{ title: '프롬프트', panel: 'prompt' as const, icon: AlignLeft }] : []),
        { title: 'Queue', panel: 'queue' as const, icon: ListTodo },
    ]
    const bottomItems = [{ title: '설정', panel: 'settings' as const, icon: Settings }]

    function handlePanelClick(panel: SidebarPanel) {
        if (activePanel === panel) {
            setOpen(!open)
        } else {
            setActivePanel(panel)
            setOpen(true)
            const url = new URL(window.location.href)
            url.searchParams.set('sidebar', panel)
            window.history.replaceState(null, '', url.toString())
        }
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
                <SidebarHeader />
                <Base.SidebarContent>
                    <Base.SidebarGroup className="h-full">
                        <Base.SidebarGroupContent className="h-full px-1.5 md:px-0">
                            <Base.SidebarMenu className="flex h-full flex-col">
                                {topItems.map((item) => (
                                    <Base.SidebarMenuItem key={item.title}>
                                        <Base.SidebarMenuButton
                                            tooltip={item.title}
                                            onClick={() => handlePanelClick(item.panel)}
                                            isActive={activePanel === item.panel}
                                            className="px-2.5 md:px-2"
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
                                                onClick={() => handlePanelClick(item.panel)}
                                                isActive={activePanel === item.panel}
                                                className="px-2.5 md:px-2"
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
            </Base.Sidebar>

            {/* Panel */}
            <Base.Sidebar collapsible="none" className="hidden flex-1 md:flex">
                {activePanel === 'project' && <SidebarProject />}
                {activePanel === 'prompt' && projectId && <SidebarPrompt projectId={projectId} />}
                {activePanel === 'queue' && <SidebarQueue projectId={projectId} />}
                {activePanel === 'settings' && <SidebarSettings />}
                <Base.SidebarRail />
            </Base.Sidebar>
        </Base.Sidebar>
    )
}
