import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    type DragStartEvent,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import { rectSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import type { Image } from '@nai-factory/shared'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Check, Trash2, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog'
import { StatusMessage } from '@/components/status-message'
import { Button } from '@/components/ui/button'
import { useDragSelection } from '@/hooks/use-drag-selection'
import { assetUrl } from '@/lib/api'
import { queries } from '@/lib/queries'
import { comparePosition, reorderById } from '@/lib/reorder'

import { SortableImageItem } from './sortable-image-item'
import { useImageMutations } from './use-image-mutations'
import { VirtualImageGrid } from './virtual-image-grid'

export function ImagesPage({ sceneId }: { sceneId: number }) {
    const navigate = useNavigate()

    const sceneQuery = useQuery(queries.scenes.get(sceneId))

    const imagesQuery = useQuery(queries.images.list(sceneId))

    const [deleteTarget, setDeleteTarget] = useState<Image | null>(null)
    const [deleteSelectedOpen, setDeleteSelectedOpen] = useState(false)
    const [draggingId, setDraggingId] = useState<number | null>(null)
    const reorderRequestIdRef = useRef(0)
    const images = useMemo(
        () => [...(imagesQuery.data ?? [])].sort(comparePosition),
        [imagesQuery.data],
    )
    const selection = useDragSelection(images)
    const { selectedIds, orderedSelectedIds: selectedImageIds } = selection
    const selectedCount = selectedImageIds.length
    const selectMode = selectedCount > 0
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

    const { deleteImages, reorderImage } = useImageMutations({
        sceneId,
        projectId: sceneQuery.data?.projectId,
        latestReorderId: reorderRequestIdRef,
        onDeleted: (imageIds) => {
            setDeleteTarget(null)
            setDeleteSelectedOpen(false)
            return selection.take(imageIds)
        },
    })

    const draggingIndex =
        draggingId === null ? -1 : images.findIndex((img) => img.id === draggingId)

    function handleDragStart(event: DragStartEvent) {
        setDraggingId(Number(event.active.id))
    }

    function handleDragEnd(event: DragEndEvent) {
        setDraggingId(null)
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
            <div className="flex min-h-0 flex-1 flex-col gap-4">
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
                            onClick={selection.selectAll}
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
                            onClick={selection.clear}
                        >
                            <X className="h-4 w-4" />
                            해제
                        </Button>
                    )}
                </div>

                {imagesQuery.isPending ? (
                    <StatusMessage>불러오는 중...</StatusMessage>
                ) : images.length === 0 ? (
                    <StatusMessage>생성된 이미지가 없습니다.</StatusMessage>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDragCancel={() => setDraggingId(null)}
                    >
                        <SortableContext
                            items={images.map((img) => img.id)}
                            strategy={rectSortingStrategy}
                        >
                            <VirtualImageGrid
                                items={images}
                                pinnedIndex={draggingIndex < 0 ? null : draggingIndex}
                                onEmptyPointerDown={selection.gridPointerDown}
                                renderItem={(img, index) => (
                                    <SortableImageItem
                                        key={img.id}
                                        img={img}
                                        index={index}
                                        imageUrl={assetUrl(img.thumbAssetId)}
                                        selected={selectedIds.has(img.id)}
                                        onView={(img) =>
                                            selectMode
                                                ? selection.toggle(img.id)
                                                : navigate({
                                                      to: '/scene/$sceneId/images/$imageId',
                                                      params: {
                                                          sceneId: String(sceneId),
                                                          imageId: String(img.id),
                                                      },
                                                  })
                                        }
                                        onDelete={(img) => setDeleteTarget(img)}
                                        onToggleSelect={selection.toggle}
                                        onSelectDragStart={selection.selectDragStart}
                                        onSelectDragEnter={selection.selectDragEnter}
                                    />
                                )}
                            />
                        </SortableContext>
                    </DndContext>
                )}
            </div>

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
                onConfirm={async () => {
                    await deleteImages.mutateAsync(selectedImageIds)
                }}
            />
        </>
    )
}
