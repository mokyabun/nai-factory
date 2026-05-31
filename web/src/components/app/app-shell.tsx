import { useQueryClient } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { useAtom } from 'jotai'
import { FileJson } from 'lucide-react'
import { useEffect, useLayoutEffect } from 'react'
import { SdStudioImportDialog } from '@/components/app/dialogs/sd-studio-import-dialog'
import { Header } from '@/components/app/header'
import { QueueFailureAlerts } from '@/components/app/queue-failure-alerts'
import { Sidebar } from '@/components/app/sidebar'
import { StatusBar } from '@/components/app/status-bar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useActiveProjectId } from '@/hooks/use-active-project-id'
import { useJsonDrop } from '@/hooks/use-json-drop'
import { useRealtimeInvalidation } from '@/hooks/use-realtime-invalidation'
import { activeProjectIdAtom, importDialogOpenAtom } from './atom'

interface AppShellProps {
    children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
    const queryClient = useQueryClient()
    const pathname = useRouterState({ select: (state) => state.location.pathname })
    const activeProjectId = useActiveProjectId(pathname)
    const { isDragOver, pendingFile, dragHandlers, clearPendingFile } = useJsonDrop()
    const [importDialogOpen, setImportDialogOpen] = useAtom(importDialogOpenAtom)
    const [storedProjectId, setStoredProjectId] = useAtom(activeProjectIdAtom)

    useRealtimeInvalidation(queryClient)

    useLayoutEffect(() => {
        if (activeProjectId !== null) setStoredProjectId(activeProjectId)
    }, [activeProjectId, setStoredProjectId])

    useEffect(() => {
        if (pendingFile) setImportDialogOpen(true)
    }, [pendingFile, setImportDialogOpen])

    function handleImportDialogOpenChange(open: boolean) {
        setImportDialogOpen(open)
        if (!open) clearPendingFile()
    }

    return (
        <>
            <div className="relative flex h-screen flex-col overflow-hidden" {...dragHandlers}>
                {isDragOver && (
                    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary bg-background/90 px-16 py-12">
                            <FileJson className="size-12 text-primary" />
                            <p className="text-base font-medium">SD Studio JSON 파일 놓기</p>
                        </div>
                    </div>
                )}

                <SidebarProvider style={{ '--sidebar-width': '350px' } as React.CSSProperties}>
                    <Sidebar />
                    <SidebarInset className="flex flex-col overflow-hidden">
                        <Header />
                        <main className="flex flex-1 flex-col overflow-auto p-4">{children}</main>
                        <StatusBar />
                    </SidebarInset>
                </SidebarProvider>
                <QueueFailureAlerts />
            </div>

            <SdStudioImportDialog
                open={importDialogOpen}
                onOpenChange={handleImportDialogOpenChange}
                file={pendingFile}
                projectId={storedProjectId}
            />
        </>
    )
}
