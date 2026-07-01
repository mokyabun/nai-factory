import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AppShell } from '@/components/app/app-shell'

const SIDEBAR_PANELS = ['project', 'playground', 'prompt', 'queue'] as const
type SidebarPanel = (typeof SIDEBAR_PANELS)[number]

export const Route = createRootRoute({
    validateSearch: (search: Record<string, unknown>): { sidebar?: SidebarPanel } => ({
        sidebar:
            typeof search.sidebar === 'string' && isSidebarPanel(search.sidebar)
                ? search.sidebar
                : undefined,
    }),
    component: RootComponent,
})

function isSidebarPanel(value: string): value is SidebarPanel {
    return SIDEBAR_PANELS.includes(value as SidebarPanel)
}

function RootComponent() {
    return (
        <AppShell>
            <Outlet />
        </AppShell>
    )
}
