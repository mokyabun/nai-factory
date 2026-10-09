import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { ConfirmDeleteDialog } from '@/components/app/dialogs/confirm-delete-dialog'
import { CreateSceneDialog } from '@/components/app/dialogs/create-scene-dialog'
import { ExportDialog } from '@/components/app/project/export-dialog'
import { ProjectSettingsDialog } from '@/components/app/project/project-settings-dialog'
import { SceneGrid } from '@/components/app/project/scene-grid'
import { type ProjectPageDialog, SceneToolbar } from '@/components/app/project/scene-toolbar'
import { StashDialog } from '@/components/app/project/stash-dialog'
import { useLocalOrder } from '@/hooks/use-local-order'
import { useProjectSceneActions } from '@/hooks/use-project-scene-actions'
import { useProjectSettings } from '@/hooks/use-project-settings'
import { useProjectStash } from '@/hooks/use-project-stash'
import { useQueueStatus } from '@/hooks/use-queue'
import { useSceneSelection } from '@/hooks/use-scene-selection'
import { queries } from '@/lib/queries'

export const Route = createFileRoute('/project/$projectId/')({ component: ProjectPage })

function ProjectPage() {
    const { projectId } = Route.useParams()
    // Keyed by project, so selection, dialogs and unsaved settings never carry over.
    return <ProjectPageContent key={projectId} projectId={Number(projectId)} />
}

function ProjectPageContent({ projectId }: { projectId: number }) {
    const projectQuery = useQuery(queries.projects.get(projectId))
    const scenesQuery = useQuery(queries.scenes.list(projectId))
    const { status: queueStatus } = useQueueStatus()

    // Drags reorder the grid at once; the cache follows in the move mutation.
    const [items, setOrder] = useLocalOrder(scenesQuery.data)
    const [projectDialog, setProjectDialog] = useState<ProjectPageDialog | null>(null)
    const closeDialog = () => setProjectDialog(null)

    const settings = useProjectSettings(projectId, projectQuery.data)
    const selection = useSceneSelection(items)
    const pageCallbacks = { takeSelection: selection.take, closeDialog }
    const sceneActions = useProjectSceneActions(projectId, pageCallbacks)
    const stash = useProjectStash(projectId, pageCallbacks)

    const { selectedIds, selectedSceneIds } = selection
    const selectedCount = selectedSceneIds.length
    const selectMode = selectedCount > 0
    const handleDialogOpenChange = (open: boolean) => {
        if (!open) closeDialog()
    }
    const current = queueStatus.current

    return (
        <div className="flex h-full flex-col gap-4">
            <SceneToolbar
                sceneCount={items.length}
                hasScenes={items.length > 0}
                selectMode={selectMode}
                selectedCount={selectedCount}
                projectLoaded={!!projectQuery.data}
                enqueuePending={sceneActions.enqueuePending}
                deletePending={sceneActions.deletePending}
                onSelectAll={selection.selectAll}
                onClearSelection={selection.clear}
                onEnqueue={(position) => sceneActions.enqueueScenes(selectedSceneIds, position)}
                onOpenDialog={setProjectDialog}
            />

            {scenesQuery.isPending ? (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                    불러오는 중...
                </div>
            ) : items.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
                    <p className="text-sm">씬이 없습니다. 새 씬을 추가하세요.</p>
                </div>
            ) : (
                <SceneGrid
                    items={items}
                    selectedIds={selectedIds}
                    selectMode={selectMode}
                    processingSceneId={current?.kind === 'scene' ? current.sceneId : null}
                    slideshowCount={settings.slideshowImageCount}
                    cardSize={settings.sceneCardSize}
                    onReorder={(reordered, patch) => {
                        setOrder(reordered)
                        sceneActions.moveScene(reordered, patch)
                    }}
                    onToggleSelect={selection.toggle}
                    onSelectDragStart={selection.selectDragStart}
                    onSelectDragEnter={selection.selectDragEnter}
                    onGridPointerDown={selection.gridPointerDown}
                />
            )}

            <CreateSceneDialog
                open={projectDialog?.type === 'create-scene'}
                onOpenChange={handleDialogOpenChange}
                onCreate={sceneActions.createScene}
            />
            <ConfirmDeleteDialog
                open={projectDialog?.type === 'delete-selected'}
                onOpenChange={handleDialogOpenChange}
                title="선택 씬 삭제"
                description={`선택한 씬 ${selectedCount}개와 모든 생성된 이미지를 삭제합니다. 되돌릴 수 없습니다.`}
                onConfirm={() => sceneActions.deleteScenes(selectedSceneIds)}
            />
            <ExportDialog
                open={projectDialog?.type === 'export'}
                onOpenChange={handleDialogOpenChange}
                project={projectQuery.data ?? null}
                scenes={items}
            />
            <ProjectSettingsDialog
                open={projectDialog?.type === 'settings'}
                onOpenChange={handleDialogOpenChange}
                slideshowImageCount={settings.slideshowImageCount}
                sceneCardSize={settings.sceneCardSize}
                project={projectQuery.data ?? null}
                scenes={items}
                selectedSceneIds={selectedSceneIds}
                onSlideshowImageCountChange={settings.setSlideshowImageCount}
                onSceneCardSizeChange={settings.setSceneCardSize}
            />
            <StashDialog
                open={projectDialog?.type === 'stash'}
                onOpenChange={handleDialogOpenChange}
                project={projectQuery.data}
                scenes={items}
                selectedSceneIds={selectedSceneIds}
                stashItems={stash.items}
                isPending={stash.isPending}
                onSave={(body) => stash.save.mutateAsync(body)}
                onDelete={(item) => stash.remove.mutateAsync(item.id)}
                onApply={(item, mode) => stash.apply.mutateAsync({ id: item.id, mode })}
            />
        </div>
    )
}
