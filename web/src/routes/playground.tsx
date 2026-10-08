import type { PlaygroundImage } from '@nai-factory/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowUp, Download, ImageIcon, Info, Loader, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { ImageProgressBar, imageTimingLabel } from '@/components/app/generation/generation-progress'
import { ImageMetadataSheet } from '@/components/app/images/image-metadata-sheet'
import { ImageReuseMenu } from '@/components/app/images/image-reuse-menu'
import { ImageSurface } from '@/components/app/images/image-surface'
import { Button, buttonVariants } from '@/components/ui/button'
import { useGenerationStatus } from '@/hooks/use-queue'
import { assetUrl, call, contract } from '@/lib/api'
import { restoreSnapshot, snapshotQuery } from '@/lib/optimistic'
import { qk } from '@/lib/queries'

export const Route = createFileRoute('/playground')({ component: PlaygroundPage })

function PlaygroundPage() {
    const queryClient = useQueryClient()
    // null follows the newest result; an id pins the viewer to an older one.
    const [pinnedImageId, setPinnedImageId] = useState<number | null>(null)
    // Newest result id when the viewer was pinned, to count results that arrived since.
    const [seenLatestId, setSeenLatestId] = useState<number | null>(null)
    const [metadataOpen, setMetadataOpen] = useState(false)
    const { job, progress } = useGenerationStatus()

    const imagesQuery = useQuery({
        queryKey: qk.playground.images(),
        queryFn: () => call(contract.playground.images, { query: { limit: 40 } }),
    })

    const images = useMemo(() => imagesQuery.data ?? [], [imagesQuery.data])
    const latestImage = images[0] ?? null
    const pinnedImage = useMemo(
        () => images.find((image) => image.id === pinnedImageId) ?? null,
        [images, pinnedImageId],
    )
    // A pinned image that is gone (deleted or past the list limit) falls back to following.
    const following = pinnedImage === null
    const selectedImage = pinnedImage ?? latestImage
    const newResultCount = following
        ? 0
        : images.filter((image) => image.id > (seenLatestId ?? Infinity)).length
    const generatingHere = job?.kind === 'playground'

    function selectImage(image: PlaygroundImage) {
        if (image.id === latestImage?.id) {
            setPinnedImageId(null)
            return
        }
        if (following) setSeenLatestId(latestImage?.id ?? null)
        setPinnedImageId(image.id)
    }

    const deleteImage = useMutation({
        mutationFn: (image: PlaygroundImage) =>
            call(contract.playground.deleteImage, { params: { id: image.id } }),
        onMutate: async (image) => {
            const previousImages = await snapshotQuery<PlaygroundImage[]>(
                queryClient,
                qk.playground.images(),
            )
            queryClient.setQueryData<PlaygroundImage[]>(
                qk.playground.images(),
                (items) => items?.filter((item) => item.id !== image.id) ?? items,
            )
            setPinnedImageId((id) => (id === image.id ? null : id))
            return { previousImages, pinnedImageId }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshot(queryClient, context?.previousImages)
            setPinnedImageId(context?.pinnedImageId ?? null)
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: qk.playground.images() }),
    })

    return (
        <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_112px]">
            <div className="flex min-h-0 flex-col gap-2">
                <div className="flex h-9 shrink-0 items-center justify-end gap-1">
                    {selectedImage && (
                        <>
                            <ImageReuseMenu
                                metadata={selectedImage.metadata}
                                source={{ type: 'playground' }}
                                triggerClassName="hover:bg-muted"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setMetadataOpen(true)}
                                aria-label="메타데이터 보기"
                            >
                                <Info className="h-4 w-4" />
                            </Button>
                            <a
                                href={assetUrl(selectedImage.assetId)}
                                download
                                aria-label="다운로드"
                                className={buttonVariants({ variant: 'ghost', size: 'icon' })}
                            >
                                <Download className="h-4 w-4" />
                            </a>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="hover:text-destructive"
                                onClick={() => deleteImage.mutate(selectedImage)}
                                disabled={deleteImage.isPending}
                                aria-label="삭제"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </>
                    )}
                </div>
                <section className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-muted/25">
                    {imagesQuery.isPending ? (
                        <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
                    ) : selectedImage ? (
                        <ImageSurface image={selectedImage} alt="Playground result" />
                    ) : generatingHere ? (
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                            <Loader className="h-8 w-8 animate-spin opacity-60 motion-reduce:animate-none" />
                            <span className="text-sm">첫 이미지를 생성하는 중입니다</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                            <ImageIcon className="h-14 w-14 opacity-30" />
                            <span className="text-sm">생성된 이미지가 없습니다</span>
                        </div>
                    )}

                    {newResultCount > 0 && (
                        <Button
                            type="button"
                            size="sm"
                            className="absolute top-3 left-1/2 -translate-x-1/2 gap-1.5 shadow-md"
                            onClick={() => setPinnedImageId(null)}
                        >
                            <ArrowUp className="h-3.5 w-3.5" />새 결과 {newResultCount}개
                        </Button>
                    )}

                    {generatingHere && selectedImage && (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col">
                            <div className="mb-2 ml-3 flex w-fit items-center gap-1.5 bg-background/85 px-2 py-1 text-xs tabular-nums shadow-sm">
                                <Loader className="h-3 w-3 animate-spin motion-reduce:animate-none" />
                                생성 중 · {imageTimingLabel(progress)}
                            </div>
                            <ImageProgressBar
                                progress={progress}
                                className="h-1 bg-background/40"
                            />
                        </div>
                    )}
                </section>
            </div>

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
                        onClick={() => selectImage(image)}
                    >
                        <img
                            src={assetUrl(image.thumbAssetId)}
                            alt=""
                            className="h-full w-full object-cover"
                        />
                        <span className="absolute inset-x-0 bottom-0 truncate bg-background/85 px-1.5 py-1 text-left text-[10px] opacity-0 transition-opacity group-hover:opacity-100">
                            {image.prompt}
                        </span>
                    </button>
                ))}
            </aside>

            <ImageMetadataSheet
                label={selectedImage ? `Playground #${selectedImage.id}` : null}
                metadata={selectedImage?.metadata ?? {}}
                open={metadataOpen}
                onOpenChange={setMetadataOpen}
            />
        </div>
    )
}
