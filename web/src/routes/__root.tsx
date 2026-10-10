import { createRootRoute, Outlet } from '@tanstack/react-router'

import { AppShell } from '@/app/app-shell'
import { isSidebarPanel, type SidebarPanel } from '@/app/sidebar/sidebar-panels'

export const Route = createRootRoute({
    validateSearch: (search: Record<string, unknown>): { sidebar?: SidebarPanel } => ({
        sidebar: isSidebarPanel(search.sidebar) ? search.sidebar : undefined,
    }),
    component: RootComponent,
})

function RootComponent() {
    return (
        <AppShell>
            <Outlet />
        </AppShell>
    )
}
