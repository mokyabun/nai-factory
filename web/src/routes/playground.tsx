import type { PlaygroundImage } from '@nai-factory/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ImageIcon, Loader, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { api, imageUrl } from '@/lib/api'
import { qk } from '@/lib/queries'

export const Route = createFileRoute('/playground')({ component: PlaygroundPage })

function PlaygroundPage() {
    const queryClient = useQueryClient()
    const [selectedImageId, setSelectedImageId] = useState<number | null>(null)

    const imagesQuery = useQuery({
        queryKey: qk.playgroundImages(),
        queryFn: async () => {
            const { data } = await api.playground.images.get({ query: { limit: 40 } })
            return data ?? []
        },
    })

    const images = imagesQuery.data ?? []
    const latestImage = images[0] ?? null
    const selectedImage = useMemo(
        () => images.find((image) => image.id === selectedImageId) ?? latestImage,
        [images, latestImage, selectedImageId],
    )

    useEffect(() => {
        if (!selectedImageId && latestImage) setSelectedImageId(latestImage.id)
    }, [latestImage, selectedImageId])

    const deleteImage = useMutation({
        mutationFn: (image: PlaygroundImage) => api.playground.images.delete({ id: image.id }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.playgroundImages() }),
    })

    return (
        <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_112px]">
            <section className="flex min-h-0 items-center justify-center overflow-hidden bg-muted/25">
                {imagesQuery.isPending ? (
                    <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : selectedImage ? (
                    <img
                        src={imageUrl(selectedImage.filePath)}
                        alt="Playground result"
                        className="max-h-full max-w-full object-contain"
                    />
                ) : (
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <ImageIcon className="h-14 w-14 opacity-30" />
                        <span className="text-sm">생성된 이미지가 없습니다</span>
                    </div>
                )}
            </section>

            <aside className="flex min-h-0 flex-col gap-2 overflow-y-auto border-l pl-3">
                <div className="h-8 shrink-0 text-xs font-medium text-muted-foreground">최근</div>
                {images.map((image) => (
                    <button
                        key={image.id}
                        type="button"
                        className={[
                            'group relative aspect-square w-full overflow-hidden border bg-muted transition-colors',
                            selectedImage?.id === image.id ? 'border-primary' : 'hover:border-ring',
                        ].join(' ')}
                        onClick={() => setSelectedImageId(image.id)}
                    >
                        <img
                            src={imageUrl(image.thumbnailPath ?? image.filePath)}
                            alt=""
                            className="h-full w-full object-cover"
                        />
                        <span className="absolute inset-x-0 bottom-0 truncate bg-background/85 px-1.5 py-1 text-left text-[10px] opacity-0 transition-opacity group-hover:opacity-100">
                            {image.prompt}
                        </span>
                    </button>
                ))}
                {selectedImage && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-8 gap-1.5 text-xs"
                        onClick={() => deleteImage.mutate(selectedImage)}
                        disabled={deleteImage.isPending}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        삭제
                    </Button>
                )}
            </aside>
        </div>
    )
}
