import type { Image } from '@nai-factory/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ConfirmDeleteDialog } from '@/components/app/dialogs/confirm-delete-dialog'
import { SortableImageItem } from '@/components/app/project/sortable-image-item'
import { Button } from '@/components/ui/button'
import { api, imageUrl } from '@/lib/api'
import { qk } from '@/lib/queries'

export const Route = createFileRoute('/scene/$sceneId/images/')({ component: ImagesPage })

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
    const images = useMemo(
        () =>
            [...(imagesQuery.data ?? [])].sort(
                (a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
                    b.id - a.id,
            ),
        [imagesQuery.data],
    )

    const deleteImage = useMutation({
        mutationFn: (img: Image) => api.images({ id: img.id }).delete(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: qk.images(scenId) })
            setDeleteTarget(null)
        },
    })

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
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 pb-4">
                        {images.map((img) => (
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
                    deleteImage.mutate(deleteTarget)
                }}
            />
        </>
    )
}
