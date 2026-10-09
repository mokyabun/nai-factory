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
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Check, Trash2, X } from 'lucide-react'
import { type PointerEvent, useEffect, useMemo, useRef, useState } from 'react'

import { ConfirmDeleteDialog } from '@/components/app/dialogs/confirm-delete-dialog'
import { SortableImageItem } from '@/components/app/project/sortable-image-item'
import { StatusMessage } from '@/components/app/status-message'
import { Button } from '@/components/ui/button'
import { useSceneImageActions } from '@/hooks/use-scene-image-actions'
import { assetUrl } from '@/lib/api'
import { queries } from '@/lib/queries'
import { comparePosition, reorderById } from '@/lib/reorder'

export const Route = createFileRoute('/scene/$sceneId/images/')({ component: ImagesPage })

interface SelectionDragState {
    startIndex: number | null
    action: 'select' | 'deselect'
    baseSelectedIds: Set<number>
}

function ImagesPage() {
    const { sceneId } = Route.useParams()
    const navigate = useNavigate()
    const scenId = Number(sceneId)

    const sceneQuery = useQuery(queries.scenes.get(scenId))

    const imagesQuery = useQuery(queries.images.list(scenId))

    const [deleteTarget, setDeleteTarget] = useState<Image | null>(null)
    const [deleteSelectedOpen, setDeleteSelectedOpen] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set<number>())
    const selectionDragRef = useRef<SelectionDragState | null>(null)
    const reorderRequestIdRef = useRef(0)
    const images = useMemo(
        () => [...(imagesQuery.data ?? [])].sort(comparePosition),
        [imagesQuery.data],
    )
    // Ids of images that are gone stay in the set but never count as selected.
    const selectedImageIds = useMemo(
        () => images.filter((img) => selectedIds.has(img.id)).map((img) => img.id),
        [images, selectedIds],
    )
    const selectedCount = selectedImageIds.length
    const selectMode = selectedCount > 0
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

    const { deleteImages, reorderImage } = useSceneImageActions({
        sceneId: scenId,
        projectId: sceneQuery.data?.projectId,
        latestReorderId: reorderRequestIdRef,
        onDeleted: (imageIds) => {
            const previous = selectedIds
            setSelectedIds((current) => {
                const next = new Set(current)
                for (const id of imageIds) next.delete(id)
                return next
            })
            setDeleteTarget(null)
            setDeleteSelectedOpen(false)
            return previous
        },
        onDeleteFailed: setSelectedIds,
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
            void navigate({ to: '/project/$projectId', params: { projectId: String(projectId) } })
            return
        }

        void navigate({ to: '/' })
    }

    return (
        <>
            <div className="flex h-full flex-col gap-4">
                {/* Header */}
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
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
                    <StatusMessage>불러오는 중...</StatusMessage>
                ) : images.length === 0 ? (
                    <StatusMessage>생성된 이미지가 없습니다.</StatusMessage>
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
                                        imageUrl={assetUrl(img.thumbAssetId)}
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

function isEditableTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false
    return (
        target.isContentEditable ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
    )
}
