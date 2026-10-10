import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { AppSidebar } from '@/app/sidebar/app-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { FileImport } from '@/features/import/file-import'
import { GenerationDock } from '@/features/queue/generation-dock'
import { QueueFailureAlerts } from '@/features/queue/queue-failure-alerts'
import { useActiveProjectId } from '@/hooks/use-active-project-id'

import { AccessTokenDialog } from './access-token-dialog'
import { AppHeader } from './app-header'
import { useRealtimeInvalidation } from './use-realtime-invalidation'

interface AppShellProps {
    children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
    const queryClient = useQueryClient()
    const activeProjectId = useActiveProjectId()
    // Pages without a project (settings, log, playground) keep working on the last one opened.
    const [lastProjectId, setLastProjectId] = useState<number | null>(null)
    if (activeProjectId !== null && activeProjectId !== lastProjectId) {
        setLastProjectId(activeProjectId)
    }
    const contextProjectId = activeProjectId ?? lastProjectId

    useRealtimeInvalidation(queryClient)

    return (
        <>
            <FileImport
                projectId={contextProjectId}
                className="relative flex h-screen flex-col overflow-hidden"
            >
                <SidebarProvider
                    className="app-sidebar-no-motion"
                    style={{ '--sidebar-width': '350px' } as React.CSSProperties}
                >
                    <AppSidebar projectId={contextProjectId} />
                    <SidebarInset className="flex flex-col overflow-hidden">
                        <AppHeader />
                        <main className="flex flex-1 flex-col overflow-auto p-4">{children}</main>
                        <GenerationDock />
                    </SidebarInset>
                    <QueueFailureAlerts />
                </SidebarProvider>
            </FileImport>

            <Toaster position="bottom-right" />
            <AccessTokenDialog />
        </>
    )
}
