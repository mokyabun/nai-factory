import { SceneJsonData, type SceneJsonData as SceneJsonDataType } from '@nai-factory/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { FileJson } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { call, contract } from '@/lib/api'
import { qk } from '@/lib/queries'

import { SceneJsonImportDialog } from './scene-json-import-dialog'
import { SdStudioImportDialog } from './sd-studio-import-dialog'
import { useJsonDrop } from './use-file-drop'

// Reused so the loading toast of a `.naif` import turns into its result.
const IMPORT_TOAST_ID = 'file-import'

interface FileImportProps {
    projectId: number | null
    className?: string
    children: React.ReactNode
}

export function FileImport({ projectId, className, children }: FileImportProps) {
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const { isDragOver, pendingFile, dragHandlers, clearPendingFile } = useJsonDrop()
    const [importDialogOpen, setImportDialogOpen] = useState(false)
    const [sceneJsonImportOpen, setSceneJsonImportOpen] = useState(false)
    const [pendingSceneJsonData, setPendingSceneJsonData] = useState<SceneJsonDataType | null>(null)

    useEffect(() => {
        if (!pendingFile) return

        const file = pendingFile
        const lowerName = file.name.toLowerCase()

        async function processDroppedFile() {
            if (lowerName.endsWith('.naif')) {
                toast.loading('.naif 가져오는 중...', { id: IMPORT_TOAST_ID })
                const data = await call(contract.projects.importArchive, {
                    body: { archive: file },
                })

                await queryClient.invalidateQueries({ queryKey: qk.groups.all() })
                queryClient.setQueryData(qk.projects.get(data.id), data)
                void navigate({ to: '/project/$projectId', params: { projectId: String(data.id) } })
                toast.success('Import 완료', { id: IMPORT_TOAST_ID })
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

            if (projectId === null) {
                toast('Scene JSON은 프로젝트 안에서 가져올 수 있습니다.')
                clearPendingFile()
                return
            }

            setPendingSceneJsonData(sceneJson.data)
            setSceneJsonImportOpen(true)
        }

        processDroppedFile().catch(() => {
            toast.error('가져오기에 실패했습니다.', { id: IMPORT_TOAST_ID })
            clearPendingFile()
        })
    }, [pendingFile, projectId, clearPendingFile, navigate, queryClient])

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
            <div className={className} {...dragHandlers}>
                {isDragOver && (
                    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary bg-background/90 px-16 py-12">
                            <FileJson className="size-12 text-primary" />
                            <p className="text-base font-medium">JSON 또는 .naif 파일 놓기</p>
                        </div>
                    </div>
                )}
                {children}
            </div>

            <SdStudioImportDialog
                open={importDialogOpen}
                onOpenChange={handleImportDialogOpenChange}
                file={pendingFile}
                projectId={projectId}
            />
            <SceneJsonImportDialog
                open={sceneJsonImportOpen}
                onOpenChange={handleSceneJsonImportOpenChange}
                data={pendingSceneJsonData}
                projectId={projectId}
            />
        </>
    )
}
