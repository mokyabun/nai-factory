import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Provider, useAtom, useAtomValue } from 'jotai'
import { useEffect } from 'react'

import { ConfirmDeleteDialog } from '@/components/app/dialogs/confirm-delete-dialog'
import { CreateSceneDialog } from '@/components/app/dialogs/create-scene-dialog'
import { ExportDialog } from '@/components/app/project/export-dialog'
import { ProjectSettingsDialog } from '@/components/app/project/project-settings-dialog'
import { SceneGrid } from '@/components/app/project/scene-grid'
import { SceneToolbar } from '@/components/app/project/scene-toolbar'
import { StashDialog } from '@/components/app/project/stash-dialog'
import { useProjectSceneActions } from '@/hooks/use-project-scene-actions'
import { useProjectSettings } from '@/hooks/use-project-settings'
import { useProjectStash } from '@/hooks/use-project-stash'
import { useQueueStatus } from '@/hooks/use-queue'
import { useSceneSelection } from '@/hooks/use-scene-selection'
import { call, contract } from '@/lib/api'
import { qk } from '@/lib/queries'

import {
    hasScenesAtom,
    projectPageDialogAtom,
    sceneItemsAtom,
    selectedSceneCountAtom,
    selectedSceneIdsAtom,
    selectedSceneIdsSetAtom,
    selectModeAtom,
} from './atom'

export const Route = createFileRoute('/project/$projectId/')({ component: ProjectPage })

function ProjectPage() {
    return (
        <Provider>
            <ProjectPageContent />
        </Provider>
    )
}

function ProjectPageContent() {
    const { projectId } = Route.useParams()
    const projId = Number(projectId)

    const projectQuery = useQuery({
        queryKey: qk.projects.get(projId),
        queryFn: () => call(contract.projects.get, { params: { id: projId } }),
    })
    const scenesQuery = useQuery({
        queryKey: qk.scenes.list(projId),
        queryFn: () => call(contract.scenes.list, { query: { projectId: projId } }),
    })
    const { status: queueStatus } = useQueueStatus()

    const [items, setItems] = useAtom(sceneItemsAtom)
    const [selectedIds, setSelectedIds] = useAtom(selectedSceneIdsSetAtom)
    const [projectDialog, setProjectDialog] = useAtom(projectPageDialogAtom)
    const selectedSceneIds = useAtomValue(selectedSceneIdsAtom)
    const selectedCount = useAtomValue(selectedSceneCountAtom)
    const selectMode = useAtomValue(selectModeAtom)
    const hasScenes = useAtomValue(hasScenesAtom)

    const settings = useProjectSettings(projectQuery.data)
    const selection = useSceneSelection(items, selectedIds)
    const { createScene, moveScene, enqueueScenes, deleteScenes } = useProjectSceneActions(
        projId,
        scenesQuery.data,
    )
    const stash = useProjectStash(projId)

    // Mirror the server list locally so drags render immediately; drop stale selections.
    useEffect(() => {
        if (!scenesQuery.data) return
        setItems(scenesQuery.data)
        const availableIds = new Set(scenesQuery.data.map((scene) => scene.id))
        setSelectedIds((prev) => {
            const next = new Set([...prev].filter((id) => availableIds.has(id)))
            return next.size === prev.size ? prev : next
        })
    }, [scenesQuery.data, setItems, setSelectedIds])

    const closeDialog = (open: boolean) => {
        if (!open) setProjectDialog(null)
    }
    const current = queueStatus.current

    return (
        <div className="flex h-full flex-col gap-4">
            <SceneToolbar
                sceneCount={items.length}
                hasScenes={hasScenes}
                selectMode={selectMode}
                selectedCount={selectedCount}
                projectLoaded={!!projectQuery.data}
                enqueuePending={enqueueScenes.isPending}
                deletePending={deleteScenes.isPending}
                onSelectAll={selection.selectAll}
                onClearSelection={selection.clear}
                onEnqueue={(position) =>
                    enqueueScenes.mutate({ sceneIds: selectedSceneIds, position })
                }
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
                        setItems(reordered)
                        moveScene.mutate(patch)
                    }}
                    onToggleSelect={selection.toggle}
                    onSelectDragStart={selection.selectDragStart}
                    onSelectDragEnter={selection.selectDragEnter}
                    onGridPointerDown={selection.gridPointerDown}
                />
            )}

            <CreateSceneDialog
                open={projectDialog?.type === 'create-scene'}
                onOpenChange={closeDialog}
                onCreate={(name) => createScene.mutate(name)}
            />
            <ConfirmDeleteDialog
                open={projectDialog?.type === 'delete-selected'}
                onOpenChange={closeDialog}
                title="선택 씬 삭제"
                description={`선택한 씬 ${selectedCount}개와 모든 생성된 이미지를 삭제합니다. 되돌릴 수 없습니다.`}
                onConfirm={() => deleteScenes.mutateAsync(selectedSceneIds)}
            />
            <ExportDialog
                open={projectDialog?.type === 'export'}
                onOpenChange={closeDialog}
                project={projectQuery.data ?? null}
                scenes={items}
            />
            <ProjectSettingsDialog
                open={projectDialog?.type === 'settings'}
                onOpenChange={closeDialog}
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
                onOpenChange={closeDialog}
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
