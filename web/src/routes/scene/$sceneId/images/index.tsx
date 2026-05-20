import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import { arrayMove, rectSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ConfirmDeleteDialog } from '#/components/app/dialogs/confirm-delete-dialog'
import { SortableImageItem } from '#/components/app/project/sortable-image-item'
import { Button } from '#/components/ui/button'
import { api, imageUrl } from '#/lib/api'
import { qk } from '#/lib/queries'

type Image = {
    id: number
    filePath: string
    thumbnailPath?: string | null
}

export const Route = createFileRoute('/scene/$sceneId/images/')({ component: ImagesPage })

function ImagesPage() {
    const { sceneId } = Route.useParams()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const scenId = Number(sceneId)

    const imagesQuery = useQuery({
        queryKey: qk.images(scenId),
        queryFn: async () => {
            const { data } = await api.images.get({ query: { sceneId: scenId } })
            return (data ?? []) as Image[]
        },
    })

    const [items, setItems] = useState<Image[]>([])
    const [deleteTarget, setDeleteTarget] = useState<Image | null>(null)

    // Sync DnD items from server data
    useEffect(() => {
        if (imagesQuery.data) setItems(imagesQuery.data)
    }, [imagesQuery.data])

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

    const deleteImage = useMutation({
        mutationFn: (img: Image) => api.images({ id: img.id }).delete(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: qk.images(scenId) })
            setDeleteTarget(null)
        },
    })

    const reorderImages = useMutation({
        mutationFn: ({
            id,
            prevId,
            nextId,
        }: {
            id: number
            prevId: number | null
            nextId: number | null
        }) => api.images({ id }).order.patch({ prevId, nextId }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.images(scenId) }),
    })

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const oldIndex = items.findIndex((i) => i.id === active.id)
        const newIndex = items.findIndex((i) => i.id === over.id)
        const newItems = arrayMove(items, oldIndex, newIndex)
        setItems(newItems)

        const prevId = newIndex > 0 ? newItems[newIndex - 1].id : null
        const nextId = newIndex < newItems.length - 1 ? newItems[newIndex + 1].id : null
        reorderImages.mutate({ id: active.id as number, prevId, nextId })
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
                        onClick={() => navigate({ to: '/scene/$sceneId', params: { sceneId } })}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium">
                        이미지 ({imagesQuery.data?.length ?? 0}장)
                    </span>
                </div>

                {/* Image grid */}
                {imagesQuery.isPending ? (
                    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                        불러오는 중...
                    </div>
                ) : items.length === 0 ? (
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
                            items={items.map((i) => i.id)}
                            strategy={rectSortingStrategy}
                        >
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 pb-4">
                                {items.map((img) => (
                                    <SortableImageItem
                                        key={img.id}
                                        img={img}
                                        imageUrl={imageUrl(img.thumbnailPath ?? img.filePath)}
                                        onView={(img) =>
                                            navigate({
                                                to: '/scene/$sceneId/images/$imageId',
                                                params: { sceneId, imageId: String(img.id) },
                                            })
                                        }
                                        onDelete={(img) => setDeleteTarget(img)}
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
                onConfirm={() => deleteTarget && deleteImage.mutate(deleteTarget)}
            />
        </>
    )
}
