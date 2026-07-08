import { SceneJsonData } from '@nai-factory/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useAtom } from 'jotai'
import { FileJson } from 'lucide-react'
import { useEffect, useLayoutEffect, useState } from 'react'
import { SdStudioImportDialog } from '@/components/app/dialogs/sd-studio-import-dialog'
import { Header } from '@/components/app/header'
import { QueueFailureAlerts } from '@/components/app/queue-failure-alerts'
import { Sidebar } from '@/components/app/sidebar'
import { StatusBar } from '@/components/app/status-bar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useActiveProjectId } from '@/hooks/use-active-project-id'
import { useJsonDrop } from '@/hooks/use-json-drop'
import { useRealtimeInvalidation } from '@/hooks/use-realtime-invalidation'
import { api } from '@/lib/api'
import { qk } from '@/lib/queries'
import { activeProjectIdAtom, importDialogOpenAtom } from './atom'

interface AppShellProps {
    children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const pathname = useRouterState({ select: (state) => state.location.pathname })
    const activeProjectId = useActiveProjectId(pathname)
    const { isDragOver, pendingFile, dragHandlers, clearPendingFile } = useJsonDrop()
    const [importDialogOpen, setImportDialogOpen] = useAtom(importDialogOpenAtom)
    const [storedProjectId, setStoredProjectId] = useAtom(activeProjectIdAtom)
    const [dropMessage, setDropMessage] = useState('')

    useRealtimeInvalidation(queryClient)

    useLayoutEffect(() => {
        if (activeProjectId !== null) setStoredProjectId(activeProjectId)
    }, [activeProjectId, setStoredProjectId])

    useEffect(() => {
        if (!pendingFile) return

        const file = pendingFile
        const lowerName = file.name.toLowerCase()

        async function processDroppedFile() {
            if (lowerName.endsWith('.naif')) {
                setDropMessage('.naif 가져오는 중...')
                const { data, error } = await api.projects.import.post({ archive: file })
                if (error || !data) throw new Error('Project archive import failed')

                await queryClient.invalidateQueries({ queryKey: qk.groupsWithProjects() })
                queryClient.setQueryData(qk.project(data.id), data)
                navigate({ to: '/project/$projectId', params: { projectId: String(data.id) } })
                setDropMessage('Import 완료')
                clearPendingFile()
                return
            }

            if (!lowerName.endsWith('.json')) {
                clearPendingFile()
                return
            }

            const raw = JSON.parse(await file.text()) as unknown
            const sceneJson = SceneJsonData.safeParse(raw)

            if (!sceneJson.success) {
                setImportDialogOpen(true)
                return
            }

            if (storedProjectId === null) {
                setDropMessage('Scene JSON은 프로젝트 안에서 가져올 수 있습니다.')
                clearPendingFile()
                return
            }

            setDropMessage('Scene JSON 가져오는 중...')
            const { error } = await api.scenes['import-json'].post({
                projectId: storedProjectId,
                data: sceneJson.data,
            })
            if (error) throw new Error('Scene JSON import failed')

            await queryClient.invalidateQueries({ queryKey: qk.scenes(storedProjectId) })
            setDropMessage('Import 완료')
            clearPendingFile()
        }

        processDroppedFile().catch(() => {
            setDropMessage('가져오기에 실패했습니다.')
            clearPendingFile()
        })
    }, [pendingFile, storedProjectId, clearPendingFile, navigate, queryClient, setImportDialogOpen])

    useEffect(() => {
        if (!dropMessage || dropMessage.endsWith('중...')) return

        const timeout = window.setTimeout(() => setDropMessage(''), 2400)
        return () => window.clearTimeout(timeout)
    }, [dropMessage])

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
                            <p className="text-base font-medium">JSON 또는 .naif 파일 놓기</p>
                        </div>
                    </div>
                )}
                {dropMessage && !isDragOver && (
                    <div className="pointer-events-none absolute top-4 right-4 z-50 rounded-md border bg-background px-3 py-2 text-sm shadow-sm">
                        {dropMessage}
                    </div>
                )}

                <SidebarProvider
                    className="app-sidebar-no-motion"
                    style={{ '--sidebar-width': '350px' } as React.CSSProperties}
                >
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
