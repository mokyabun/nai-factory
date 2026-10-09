import { SceneJsonData, type SceneJsonData as SceneJsonDataType } from '@nai-factory/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { FileJson } from 'lucide-react'
import { useEffect, useState } from 'react'

import { SceneJsonImportDialog } from '@/components/app/dialogs/scene-json-import-dialog'
import { SdStudioImportDialog } from '@/components/app/dialogs/sd-studio-import-dialog'
import { GenerationDock } from '@/components/app/generation/generation-dock'
import { Header } from '@/components/app/header'
import { QueueFailureAlerts } from '@/components/app/queue-failure-alerts'
import { Sidebar } from '@/components/app/sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useActiveProjectId } from '@/hooks/use-active-project-id'
import { useJsonDrop } from '@/hooks/use-json-drop'
import { useRealtimeInvalidation } from '@/hooks/use-realtime-invalidation'
import { call, contract } from '@/lib/api'
import { qk } from '@/lib/queries'

import { AccessTokenDialog } from './access-token-dialog'

interface AppShellProps {
    children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const activeProjectId = useActiveProjectId()
    const { isDragOver, pendingFile, dragHandlers, clearPendingFile } = useJsonDrop()
    const [importDialogOpen, setImportDialogOpen] = useState(false)
    // Pages without a project (settings, log, playground) keep working on the last one opened.
    const [lastProjectId, setLastProjectId] = useState<number | null>(null)
    if (activeProjectId !== null && activeProjectId !== lastProjectId) {
        setLastProjectId(activeProjectId)
    }
    const contextProjectId = activeProjectId ?? lastProjectId
    const [dropMessage, setDropMessage] = useState('')
    const [sceneJsonImportOpen, setSceneJsonImportOpen] = useState(false)
    const [pendingSceneJsonData, setPendingSceneJsonData] = useState<SceneJsonDataType | null>(null)

    useRealtimeInvalidation(queryClient)

    useEffect(() => {
        if (!pendingFile) return

        const file = pendingFile
        const lowerName = file.name.toLowerCase()

        async function processDroppedFile() {
            if (lowerName.endsWith('.naif')) {
                setDropMessage('.naif 가져오는 중...')
                const data = await call(contract.projects.importArchive, {
                    body: { archive: file },
                })

                await queryClient.invalidateQueries({ queryKey: qk.groups.all() })
                queryClient.setQueryData(qk.projects.get(data.id), data)
                void navigate({ to: '/project/$projectId', params: { projectId: String(data.id) } })
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

            if (contextProjectId === null) {
                setDropMessage('Scene JSON은 프로젝트 안에서 가져올 수 있습니다.')
                clearPendingFile()
                return
            }

            setPendingSceneJsonData(sceneJson.data)
            setDropMessage('')
            setSceneJsonImportOpen(true)
        }

        processDroppedFile().catch(() => {
            setDropMessage('가져오기에 실패했습니다.')
            clearPendingFile()
        })
    }, [pendingFile, contextProjectId, clearPendingFile, navigate, queryClient])

    useEffect(() => {
        if (!dropMessage || dropMessage.endsWith('중...')) return

        const timeout = window.setTimeout(() => setDropMessage(''), 2400)
        return () => window.clearTimeout(timeout)
    }, [dropMessage])

    function handleImportDialogOpenChange(open: boolean) {
        setImportDialogOpen(open)
        if (!open) clearPendingFile()
    }

    function handleSceneJsonImportOpenChange(open: boolean) {
        setSceneJsonImportOpen(open)
        if (!open) {
            setPendingSceneJsonData(null)
            clearPendingFile()
        }
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
                    <Sidebar projectId={contextProjectId} />
                    <SidebarInset className="flex flex-col overflow-hidden">
                        <Header />
                        <main className="flex flex-1 flex-col overflow-auto p-4">{children}</main>
                        <GenerationDock />
                    </SidebarInset>
                    <QueueFailureAlerts />
                </SidebarProvider>
            </div>

            <AccessTokenDialog />
            <SdStudioImportDialog
                open={importDialogOpen}
                onOpenChange={handleImportDialogOpenChange}
                file={pendingFile}
                projectId={contextProjectId}
            />
            <SceneJsonImportDialog
                open={sceneJsonImportOpen}
                onOpenChange={handleSceneJsonImportOpenChange}
                data={pendingSceneJsonData}
                projectId={contextProjectId}
            />
        </>
    )
}
