import type { EnqueuePosition } from '@nai-factory/shared'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog'
import { StatusMessage } from '@/components/status-message'
import { useQueueStatus } from '@/features/queue/use-queue'
import { useDragSelection } from '@/hooks/use-drag-selection'
import { useLocalOrder } from '@/hooks/use-local-order'
import { queries } from '@/lib/queries'

import { CreateSceneDialog } from './create-scene-dialog'
import { EnqueueConfirmDialog } from './enqueue-confirm-dialog'
import { ExportDialog } from './export-dialog'
import { ProjectSettingsDialog } from './project-settings-dialog'
import type { SceneSelectionActions } from './scene-card-menu'
import { SceneGrid } from './scene-grid'
import { type ProjectPageDialog, SceneToolbar } from './scene-toolbar'
import { StashDialog } from './stash-dialog'
import { useProjectSceneActions } from './use-project-scene-actions'
import { useProjectSettings } from './use-project-settings'
import { useProjectStash } from './use-project-stash'

export function ProjectPage({ projectId }: { projectId: number }) {
    // Keyed by project, so selection, dialogs and unsaved settings never carry over.
    return <ProjectPageContent key={projectId} projectId={projectId} />
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
    const selection = useDragSelection(items)
    const pageCallbacks = { takeSelection: selection.take, closeDialog }
    const sceneActions = useProjectSceneActions(projectId, pageCallbacks, {
        project: projectQuery.data,
        scenes: items,
    })
    const [selectionImageCount, setSelectionImageCount] = useState<number | null>(null)
    const imageCount = selectionImageCount ?? settings.defaultImageCount
    const stash = useProjectStash(projectId, pageCallbacks)

    const { selectedIds, orderedSelectedIds: selectedSceneIds } = selection
    const selectedCount = selectedSceneIds.length
    const selectMode = selectedCount > 0
    const selectedScenes = items.filter((scene) => selectedIds.has(scene.id))
    const selectedQueueCount = selectedScenes.reduce((sum, scene) => sum + scene.queueCount, 0)
    const enqueueSelected = (position: EnqueuePosition) =>
        sceneActions.enqueueScenes(selectedSceneIds, position, imageCount)
    const handleDialogOpenChange = (open: boolean) => {
        if (!open) closeDialog()
    }
    const current = queueStatus.current
    const selectionActions: SceneSelectionActions | null = selectMode
        ? {
              count: selectedCount,
              queueCount: selectedQueueCount,
              onEnqueue: enqueueSelected,
              onClearQueue: () => sceneActions.clearSceneQueues(selectedScenes),
              onDelete: () => setProjectDialog({ type: 'delete-selected' }),
          }
        : null

    return (
        <div className="flex h-full flex-col gap-4">
            <SceneToolbar
                sceneCount={items.length}
                selectedCount={selectedCount}
                selectedQueueCount={selectedQueueCount}
                imageCount={imageCount}
                selectedImageTotal={
                    sceneActions.summarizeEnqueue(selectedSceneIds, imageCount).total
                }
                projectLoaded={!!projectQuery.data}
                enqueuePending={sceneActions.enqueuePending}
                clearQueuePending={sceneActions.clearQueuePending}
                deletePending={sceneActions.deletePending}
                onSelectAll={selection.selectAll}
                onClearSelection={selection.clear}
                onImageCountChange={setSelectionImageCount}
                onEnqueue={enqueueSelected}
                onClearQueue={() => sceneActions.clearSceneQueues(selectedScenes)}
                onOpenDialog={setProjectDialog}
            />

            {scenesQuery.isPending ? (
                <StatusMessage>불러오는 중...</StatusMessage>
            ) : items.length === 0 ? (
                <StatusMessage>씬이 없습니다. 새 씬을 추가하세요.</StatusMessage>
            ) : (
                <SceneGrid
                    items={items}
                    selectedIds={selectedIds}
                    selectMode={selectMode}
                    processingSceneId={current?.kind === 'scene' ? current.sceneId : null}
                    slideshowCount={settings.slideshowImageCount}
                    cardSize={settings.sceneCardSize}
                    selectionActions={selectionActions}
                    onEnqueueScene={(sceneId, position) =>
                        sceneActions.enqueueScenes([sceneId], position)
                    }
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

            <EnqueueConfirmDialog
                summary={sceneActions.enqueueConfirmation.summary}
                onCancel={sceneActions.enqueueConfirmation.cancel}
                onConfirm={sceneActions.enqueueConfirmation.confirm}
            />
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
                defaultImageCount={settings.defaultImageCount}
                project={projectQuery.data ?? null}
                scenes={items}
                selectedSceneIds={selectedSceneIds}
                onSlideshowImageCountChange={settings.setSlideshowImageCount}
                onSceneCardSizeChange={settings.setSceneCardSize}
                onDefaultImageCountChange={settings.setDefaultImageCount}
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
