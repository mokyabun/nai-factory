import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AppShell } from '@/components/app/app-shell'

export const Route = createRootRoute({
    component: RootComponent,
})

function RootComponent() {
    return (
        <AppShell>
            <Outlet />
        </AppShell>
    )
}
