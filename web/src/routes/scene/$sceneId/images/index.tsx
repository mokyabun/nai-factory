import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import { rectSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import type { Image } from '@nai-factory/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Check, Trash2, X } from 'lucide-react'
import { type PointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ConfirmDeleteDialog } from '@/components/app/dialogs/confirm-delete-dialog'
import { SortableImageItem } from '@/components/app/project/sortable-image-item'
import { Button } from '@/components/ui/button'
import { api, imageResourceUrl, type SceneDetail, type SceneSummary } from '@/lib/api'
import { requireApiResult, restoreSnapshots, snapshotQueries } from '@/lib/optimistic'
import { qk } from '@/lib/queries'
import { compareDisplayOrder, reorderById } from '@/lib/reorder'

export const Route = createFileRoute('/scene/$sceneId/images/')({ component: ImagesPage })

interface SelectionDragState {
    startIndex: number | null
    action: 'select' | 'deselect'
    baseSelectedIds: Set<number>
}

interface ReorderImageVariables {
    requestId: number
    id: number
    prevId: number | null
    nextId: number | null
    items: Image[]
}

function ImagesPage() {
    const { sceneId } = Route.useParams()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const scenId = Number(sceneId)

    const sceneQuery = useQuery({
        queryKey: qk.scene(scenId),
        queryFn: async () => {
            const { data } = await api.scenes({ id: scenId }).get()
            return data ?? null
        },
    })

    const imagesQuery = useQuery({
        queryKey: qk.images(scenId),
        queryFn: async () => {
            const { data } = await api.images.get({ query: { sceneId: scenId } })
            return data ?? []
        },
    })

    const [deleteTarget, setDeleteTarget] = useState<Image | null>(null)
    const [deleteSelectedOpen, setDeleteSelectedOpen] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set<number>())
    const selectionDragRef = useRef<SelectionDragState | null>(null)
    const reorderRequestIdRef = useRef(0)
    const images = useMemo(
        () => [...(imagesQuery.data ?? [])].sort(compareDisplayOrder),
        [imagesQuery.data],
    )
    const selectedImageIds = useMemo(
        () => images.filter((img) => selectedIds.has(img.id)).map((img) => img.id),
        [images, selectedIds],
    )
    const selectedCount = selectedImageIds.length
    const selectMode = selectedCount > 0
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

    useEffect(() => {
        const availableIds = new Set(images.map((img) => img.id))
        setSelectedIds((prev) => {
            const next = new Set([...prev].filter((id) => availableIds.has(id)))
            return next.size === prev.size ? prev : next
        })
    }, [images])

    const deleteImages = useMutation({
        mutationFn: async (imageIds: number[]) => {
            for (const id of imageIds) {
                await requireApiResult(api.images({ id }).delete())
            }
        },
        onMutate: async (imageIds) => {
            const projectId = sceneQuery.data?.projectId
            const imageIdSet = new Set(imageIds)
            const snapshots = await snapshotQueries(queryClient, {
                predicate: (query) =>
                    query.queryKey[0] === 'images' ||
                    (query.queryKey[0] === 'scene' && query.queryKey[1] === scenId) ||
                    (projectId !== undefined &&
                        query.queryKey[0] === 'scenes' &&
                        query.queryKey[1] === projectId),
            })
            queryClient.setQueryData<Image[]>(
                qk.images(scenId),
                (items) => items?.filter((item) => !imageIdSet.has(item.id)) ?? items,
            )
            queryClient.setQueryData<SceneDetail | null>(qk.scene(scenId), (scene) =>
                scene
                    ? { ...scene, images: scene.images.filter((item) => !imageIdSet.has(item.id)) }
                    : scene,
            )
            if (projectId !== undefined) {
                queryClient.setQueryData<SceneSummary[]>(qk.scenes(projectId), (scenes) =>
                    scenes?.map((scene) =>
                        scene.id === scenId
                            ? {
                                  ...scene,
                                  imageCount: Math.max(0, scene.imageCount - imageIdSet.size),
                                  latestImages: scene.latestImages.filter(
                                      (item) => !imageIdSet.has(item.id),
                                  ),
                              }
                            : scene,
                    ),
                )
            }
            setSelectedIds((current) => {
                const next = new Set(current)
                for (const id of imageIdSet) next.delete(id)
                return next
            })
            setDeleteTarget(null)
            setDeleteSelectedOpen(false)
            return { snapshots, projectId, previousSelectedIds: selectedIds }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshots(queryClient, context?.snapshots)
            if (context?.previousSelectedIds) setSelectedIds(context.previousSelectedIds)
        },
        onSettled: (_data, _error, _variables, context) => {
            queryClient.invalidateQueries({ queryKey: qk.images(scenId) })
            queryClient.invalidateQueries({ queryKey: qk.scene(scenId) })
            if (context?.projectId !== undefined) {
                queryClient.invalidateQueries({ queryKey: qk.scenes(context.projectId) })
            }
        },
    })

    const reorderImage = useMutation({
        mutationFn: async ({ id, prevId, nextId }: ReorderImageVariables) => {
            const { data } = await requireApiResult(
                api.images({ id }).order.patch({ prevId, nextId }),
            )
            return data ?? []
        },
        onMutate: async ({ items }) => {
            const projectId = sceneQuery.data?.projectId
            const snapshots = await snapshotQueries(queryClient, {
                predicate: (query) =>
                    query.queryKey[0] === 'images' ||
                    (query.queryKey[0] === 'scene' && query.queryKey[1] === scenId) ||
                    (projectId !== undefined &&
                        query.queryKey[0] === 'scenes' &&
                        query.queryKey[1] === projectId),
            })
            const now = new Date().toISOString()
            const orderedItems = items.map((item, index) => ({
                ...item,
                displayOrder: `optimistic-${now}-${String(index).padStart(6, '0')}`,
            }))
            queryClient.setQueryData<Image[]>(qk.images(scenId), orderedItems)
            queryClient.setQueryData<SceneDetail | null>(qk.scene(scenId), (scene) =>
                scene ? { ...scene, images: orderedItems } : scene,
            )
            if (projectId !== undefined) {
                queryClient.setQueryData<SceneSummary[]>(qk.scenes(projectId), (scenes) =>
                    scenes?.map((scene) =>
                        scene.id === scenId
                            ? {
                                  ...scene,
                                  latestImages: orderedItems.slice(0, 10).map(toSceneImage),
                              }
                            : scene,
                    ),
                )
            }
            return { snapshots, projectId }
        },
        onError: (_error, variables, context) => {
            if (variables.requestId !== reorderRequestIdRef.current) return
            restoreSnapshots(queryClient, context?.snapshots)
        },
        onSuccess: (items, variables, context) => {
            if (variables.requestId !== reorderRequestIdRef.current) return
            queryClient.setQueryData<Image[]>(qk.images(scenId), items)
            queryClient.setQueryData<SceneDetail | null>(qk.scene(scenId), (scene) =>
                scene ? { ...scene, images: items } : scene,
            )
            if (context?.projectId !== undefined) {
                queryClient.setQueryData<SceneSummary[]>(qk.scenes(context.projectId), (scenes) =>
                    scenes?.map((scene) =>
                        scene.id === scenId
                            ? {
                                  ...scene,
                                  latestImages: items.slice(0, 10).map(toSceneImage),
                              }
                            : scene,
                    ),
                )
            }
        },
        onSettled: (_data, _error, _variables, context) => {
            queryClient.invalidateQueries({ queryKey: qk.scene(scenId) })
            if (context?.projectId !== undefined) {
                queryClient.invalidateQueries({ queryKey: qk.scenes(context.projectId) })
            }
        },
    })

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const activeId = Number(active.id)
        const overId = Number(over.id)

        if (!Number.isFinite(activeId) || !Number.isFinite(overId)) return

        const reordered = reorderById(images, activeId, overId)
        if (!reordered) return

        reorderImage.mutate({
            ...reordered.orderPatch,
            requestId: ++reorderRequestIdRef.current,
            items: reordered.items,
        })
    }

    function applySelectionDragRange(state: SelectionDragState, targetIndex: number) {
        if (images.length === 0) return

        if (state.startIndex === null) state.startIndex = targetIndex

        const clampedTargetIndex = Math.min(Math.max(targetIndex, 0), images.length - 1)
        const from = Math.min(state.startIndex, clampedTargetIndex)
        const to = Math.max(state.startIndex, clampedTargetIndex)
        const rangeIds = images.slice(from, to + 1).map((img) => img.id)

        setSelectedIds(() => {
            const next = new Set(state.baseSelectedIds)
            for (const id of rangeIds) {
                if (state.action === 'select') next.add(id)
                else next.delete(id)
            }
            return next
        })
    }

    function handleSelectDragStart(index: number, selected: boolean) {
        const state: SelectionDragState = {
            startIndex: index,
            action: selected ? 'deselect' : 'select',
            baseSelectedIds: new Set(selectedIds),
        }

        selectionDragRef.current = state
        applySelectionDragRange(state, index)
    }

    function handleSelectDragEnter(index: number) {
        const state = selectionDragRef.current
        if (!state) return

        applySelectionDragRange(state, index)
    }

    function handleGridPointerDown(event: PointerEvent<HTMLDivElement>) {
        if (event.button !== 0 || event.target !== event.currentTarget) return

        event.preventDefault()
        selectionDragRef.current = {
            startIndex: null,
            action: 'select',
            baseSelectedIds: new Set(selectedIds),
        }
    }

    function toggleSelect(id: number) {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    function selectAllImages() {
        setSelectedIds(new Set(images.map((img) => img.id)))
    }

    function clearSelection() {
        setSelectedIds(new Set<number>())
    }

    useEffect(() => {
        function handlePointerEnd() {
            selectionDragRef.current = null
        }

        window.addEventListener('pointerup', handlePointerEnd)
        window.addEventListener('pointercancel', handlePointerEnd)
        return () => {
            window.removeEventListener('pointerup', handlePointerEnd)
            window.removeEventListener('pointercancel', handlePointerEnd)
        }
    }, [])

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (isEditableTarget(event.target)) return

            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
                if (images.length === 0) return
                event.preventDefault()
                setSelectedIds(new Set(images.map((img) => img.id)))
                return
            }

            if (event.key === 'Escape') {
                setSelectedIds(new Set<number>())
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [images])

    function goBack() {
        const projectId = sceneQuery.data?.projectId
        if (projectId) {
            navigate({ to: '/project/$projectId', params: { projectId: String(projectId) } })
            return
        }

        navigate({ to: '/' })
    }

    return (
        <>
            <div className="flex h-full flex-col gap-4">
                {/* Header */}
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={goBack}
                        aria-label="프로젝트로 돌아가기"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium">이미지 ({images.length}장)</span>
                    {images.length > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={selectAllImages}
                            disabled={selectedCount === images.length}
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
                            variant="destructive"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => setDeleteSelectedOpen(true)}
                            disabled={deleteImages.isPending}
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
                            onClick={clearSelection}
                        >
                            <X className="h-4 w-4" />
                            해제
                        </Button>
                    )}
                </div>

                {/* Image grid */}
                {imagesQuery.isPending ? (
                    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                        불러오는 중...
                    </div>
                ) : images.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                        생성된 이미지가 없습니다.
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={images.map((img) => img.id)}
                            strategy={rectSortingStrategy}
                        >
                            <div
                                className="grid min-h-0 flex-1 content-start grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 pb-4"
                                onPointerDown={handleGridPointerDown}
                            >
                                {images.map((img, index) => (
                                    <SortableImageItem
                                        key={img.id}
                                        img={img}
                                        index={index}
                                        imageUrl={imageResourceUrl(img, 'thumbnail')}
                                        selected={selectedIds.has(img.id)}
                                        onView={(img) =>
                                            selectMode
                                                ? toggleSelect(img.id)
                                                : navigate({
                                                      to: '/scene/$sceneId/images/$imageId',
                                                      params: {
                                                          sceneId,
                                                          imageId: String(img.id),
                                                      },
                                                  })
                                        }
                                        onDelete={(img) => setDeleteTarget(img)}
                                        onToggleSelect={toggleSelect}
                                        onSelectDragStart={handleSelectDragStart}
                                        onSelectDragEnter={handleSelectDragEnter}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}
            </div>

            {/* Image viewer overlay */}
            <Outlet />

            {/* Delete dialog */}
            <ConfirmDeleteDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="이미지 삭제"
                description="이 이미지를 삭제합니다. 되돌릴 수 없습니다."
                onConfirm={() => {
                    if (!deleteTarget) return
                    deleteImages.mutate([deleteTarget.id])
                }}
            />
            <ConfirmDeleteDialog
                open={deleteSelectedOpen}
                onOpenChange={(open) => !open && setDeleteSelectedOpen(false)}
                title="선택 이미지 삭제"
                description={`선택한 이미지 ${selectedCount}장을 삭제합니다. 되돌릴 수 없습니다.`}
                onConfirm={() => deleteImages.mutateAsync(selectedImageIds)}
            />
        </>
    )
}

function toSceneImage(img: Image) {
    return {
        id: img.id,
        assetId: img.assetId,
        thumbnailAssetId: img.thumbnailAssetId,
        filePath: img.filePath,
        thumbnailPath: img.thumbnailPath,
        createdAt: img.createdAt,
    }
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
