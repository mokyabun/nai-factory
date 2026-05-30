import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import { rectSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Provider, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Check, Download, Images, ListPlus, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { ConfirmDeleteDialog } from '@/components/app/dialogs/confirm-delete-dialog'
import { CreateSceneDialog } from '@/components/app/dialogs/create-scene-dialog'
import { ExportDialog } from '@/components/app/project/export-dialog'
import { SortableSceneItem } from '@/components/app/project/sortable-scene-item'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { qk } from '@/lib/queries'
import { debounce } from '@/lib/utils'
import {
    hasScenesAtom,
    loadedProjectIdAtom,
    projectPageDialogAtom,
    reorderSceneItems,
    sceneItemsAtom,
    selectedSceneCountAtom,
    selectedSceneIdsAtom,
    selectedSceneIdsSetAtom,
    selectModeAtom,
    slideshowImageCountAtom,
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
    const queryClient = useQueryClient()
    const projId = Number(projectId)

    const projectQuery = useQuery({
        queryKey: qk.project(projId),
        queryFn: async () => {
            const { data } = await api.projects({ projectId: projId }).get()
            return data ?? null
        },
    })

    const scenesQuery = useQuery({
        queryKey: qk.scenes(projId),
        queryFn: async () => {
            const { data } = await api.scenes.get({ query: { projectId: projId } })
            return data ?? []
        },
    })

    const queueStatusQuery = useQuery({
        queryKey: qk.queueStatus(),
        queryFn: async () => {
            const { data } = await api.queue.status.get()
            return data
        },
    })

    const [items, setItems] = useAtom(sceneItemsAtom)
    const [selectedIds, setSelectedIds] = useAtom(selectedSceneIdsSetAtom)
    const [projectDialog, setProjectDialog] = useAtom(projectPageDialogAtom)
    const loadedProjectId = useAtomValue(loadedProjectIdAtom)
    const setLoadedProjectId = useSetAtom(loadedProjectIdAtom)
    const [slideshowImageCount, setSlideshowImageCount] = useAtom(slideshowImageCountAtom)
    const selectedSceneIds = useAtomValue(selectedSceneIdsAtom)
    const selectedCount = useAtomValue(selectedSceneCountAtom)
    const selectMode = useAtomValue(selectModeAtom)
    const hasScenes = useAtomValue(hasScenesAtom)

    const saveProjectSettings = useRef(
        debounce(async (projectId: number, slideshowImageCount: number) => {
            const { data } = await api
                .projects({ projectId })
                .patch({ settings: { slideshowImageCount } })
            if (data) queryClient.setQueryData(qk.project(projectId), data)
        }, 600),
    )

    // Sync items from query
    useEffect(() => {
        if (!scenesQuery.data) return

        setItems(scenesQuery.data)
        const availableIds = new Set(scenesQuery.data.map((scene) => scene.id))
        setSelectedIds((prev) => {
            const next = new Set([...prev].filter((id) => availableIds.has(id)))
            return next.size === prev.size ? prev : next
        })
    }, [scenesQuery.data, setItems, setSelectedIds])

    useEffect(() => {
        const project = projectQuery.data
        if (project && project.id !== loadedProjectId) {
            saveProjectSettings.current.cancel()
            setLoadedProjectId(project.id)
            setSlideshowImageCount(project.settings.slideshowImageCount)
        }
    }, [projectQuery.data, loadedProjectId, setLoadedProjectId, setSlideshowImageCount])

    useEffect(() => {
        return () => saveProjectSettings.current.flush()
    }, [])

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

    const createScene = useMutation({
        mutationFn: (name: string) => api.scenes.post({ projectId: projId, name }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: qk.scenes(projId) })
            setProjectDialog(null)
        },
    })

    const reorderScene = useMutation({
        mutationFn: ({
            id,
            prevId,
            nextId,
        }: {
            id: number
            prevId: number | null
            nextId: number | null
        }) => api.scenes({ id }).order.patch({ prevId, nextId }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.scenes(projId) }),
    })

    const bulkEnqueue = useMutation({
        mutationFn: (sceneIds: number[]) => api.queue['enqueue-bulk'].post({ sceneIds }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: qk.queueStatus() })
            queryClient.invalidateQueries({ queryKey: qk.queue(projId) })
            queryClient.invalidateQueries({ queryKey: qk.scenes(projId) })
            clearSelection()
        },
    })

    const deleteSelectedScenes = useMutation({
        mutationFn: async (sceneIds: number[]) => {
            for (const id of sceneIds) {
                await api.scenes({ id }).delete()
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: qk.queueStatus() })
            queryClient.invalidateQueries({ queryKey: qk.queue(projId) })
            queryClient.invalidateQueries({ queryKey: qk.scenes(projId) })
            clearSelection()
            setProjectDialog(null)
        },
    })

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const activeId = Number(active.id)
        const overId = Number(over.id)

        if (!Number.isFinite(activeId) || !Number.isFinite(overId)) return

        const reordered = reorderSceneItems(items, activeId, overId)
        if (!reordered) return

        setItems(reordered.items)
        reorderScene.mutate(reordered.orderPatch)
    }

    function toggleSelect(id: number) {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    function selectAllScenes() {
        setSelectedIds(new Set(items.map((scene) => scene.id)))
    }

    function clearSelection() {
        setSelectedIds(new Set<number>())
    }

    function handleSlideshowImageCountChange(value: string) {
        const nextCount = Math.min(10, Math.max(1, Number(value) || 1))
        setSlideshowImageCount(nextCount)
        if (loadedProjectId) saveProjectSettings.current(loadedProjectId, nextCount)
    }

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (isEditableTarget(event.target)) return

            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
                if (items.length === 0) return
                event.preventDefault()
                setSelectedIds(new Set(items.map((scene) => scene.id)))
                return
            }

            if (event.key === 'Escape') {
                setSelectedIds(new Set<number>())
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [items, setSelectedIds])
    const currentSceneId = queueStatusQuery.data?.currentSceneId ?? null

    return (
        <div className="flex h-full flex-col gap-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {hasScenes && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => selectAllScenes()}
                            disabled={selectedCount === items.length}
                        >
                            <Check className="h-4 w-4" />
                            전체 선택
                        </Button>
                    )}
                    {selectMode && (
                        <span className="text-xs font-medium text-muted-foreground">
                            {selectedCount}개 선택
                        </span>
                    )}
                    {selectMode && (
                        <Button
                            size="sm"
                            className="gap-1.5"
                            onClick={() => bulkEnqueue.mutate(selectedSceneIds)}
                            disabled={bulkEnqueue.isPending}
                        >
                            <ListPlus className="h-4 w-4" />
                            선택 큐 추가
                        </Button>
                    )}
                    {selectMode && (
                        <Button
                            variant="destructive"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => setProjectDialog({ type: 'delete-selected' })}
                            disabled={deleteSelectedScenes.isPending}
                        >
                            <Trash2 className="h-4 w-4" />
                            선택 삭제
                        </Button>
                    )}
                    {selectMode && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => clearSelection()}
                        >
                            <X className="h-4 w-4" />
                            해제
                        </Button>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1">
                        <Images className="h-3.5 w-3.5 text-muted-foreground" />
                        <Label
                            htmlFor="slideshow-image-count"
                            className="text-xs text-muted-foreground"
                        >
                            회전
                        </Label>
                        <Input
                            id="slideshow-image-count"
                            type="number"
                            min={1}
                            max={10}
                            value={slideshowImageCount}
                            onChange={(e) => handleSlideshowImageCountChange(e.target.value)}
                            className="h-6 w-12 px-1.5 text-xs"
                        />
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setProjectDialog({ type: 'export' })}
                        disabled={!projectQuery.data}
                    >
                        <Download className="h-4 w-4" />
                        Export
                    </Button>
                    <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setProjectDialog({ type: 'create-scene' })}
                    >
                        <Plus className="h-4 w-4" />새 씬
                    </Button>
                </div>
            </div>

            {/* Scene grid */}
            {scenesQuery.isPending ? (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                    불러오는 중...
                </div>
            ) : items.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
                    <p className="text-sm">씬이 없습니다. 새 씬을 추가하세요.</p>
                </div>
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext items={items.map((s) => s.id)} strategy={rectSortingStrategy}>
                        <div className="flex flex-wrap gap-4 pb-4">
                            {items.map((scene) => (
                                <SortableSceneItem
                                    key={scene.id}
                                    scene={scene}
                                    selected={selectedIds.has(scene.id)}
                                    selectMode={selectMode}
                                    isProcessing={scene.id === currentSceneId}
                                    slideshowCount={slideshowImageCount}
                                    onToggleSelect={toggleSelect}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            {/* Dialogs / panels */}
            <CreateSceneDialog
                open={projectDialog?.type === 'create-scene'}
                onOpenChange={(open) => {
                    if (!open) setProjectDialog(null)
                }}
                onCreate={(name) => createScene.mutate(name)}
            />
            <ConfirmDeleteDialog
                open={projectDialog?.type === 'delete-selected'}
                onOpenChange={(open) => {
                    if (!open) setProjectDialog(null)
                }}
                title="선택 씬 삭제"
                description={`선택한 씬 ${selectedCount}개와 모든 생성된 이미지를 삭제합니다. 되돌릴 수 없습니다.`}
                onConfirm={() => deleteSelectedScenes.mutateAsync(selectedSceneIds)}
            />
            <ExportDialog
                open={projectDialog?.type === 'export'}
                onOpenChange={(open) => {
                    if (!open) setProjectDialog(null)
                }}
                project={projectQuery.data ?? null}
                scenes={items}
            />
        </div>
    )
}

function isEditableTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false
    return (
        target.isContentEditable ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
    )
}
