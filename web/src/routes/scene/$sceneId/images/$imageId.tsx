import type { Image } from '@nai-factory/types'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useCallback, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { api, imageUrl } from '@/lib/api'
import { qk } from '@/lib/queries'

export const Route = createFileRoute('/scene/$sceneId/images/$imageId')({
    component: ImageViewerPage,
})

function ImageViewerPage() {
    const { sceneId, imageId } = Route.useParams()
    const navigate = useNavigate()
    const scenId = Number(sceneId)

    const imagesQuery = useQuery({
        queryKey: qk.images(scenId),
        queryFn: async () => {
            const { data } = await api.images.get({ query: { sceneId: scenId } })
            return data ?? []
        },
    })

    const images = useMemo(
        () =>
            [...(imagesQuery.data ?? [])].sort(
                (a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
                    b.id - a.id,
            ),
        [imagesQuery.data],
    )
    const currentIndex = images.findIndex((i) => i.id === Number(imageId))
    const current = images[currentIndex] ?? null

    const goTo = useCallback(
        (img: Image) => {
            navigate({
                to: '/scene/$sceneId/images/$imageId',
                params: { sceneId, imageId: String(img.id) },
                replace: true,
            })
        },
        [navigate, sceneId],
    )

    const goPrev = useCallback(() => {
        if (currentIndex > 0) goTo(images[currentIndex - 1])
    }, [currentIndex, images, goTo])

    const goNext = useCallback(() => {
        if (currentIndex < images.length - 1) goTo(images[currentIndex + 1])
    }, [currentIndex, images, goTo])

    // Keyboard navigation
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === 'ArrowLeft') goPrev()
            else if (e.key === 'ArrowRight') goNext()
            else if (e.key === 'Escape')
                navigate({ to: '/scene/$sceneId/images', params: { sceneId }, replace: true })
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [goPrev, goNext, navigate, sceneId])

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 py-3">
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-white/70 hover:bg-white/10 hover:text-white"
                    onClick={() =>
                        navigate({ to: '/scene/$sceneId/images', params: { sceneId }, replace: true })
                    }
                    aria-label="이미지 목록으로 돌아가기"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>

                <span className="text-sm text-white/60">
                    {currentIndex + 1} / {images.length}
                </span>

                {current && (
                    <a
                        href={imageUrl(current.filePath)}
                        download
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                    >
                        <Download className="h-5 w-5" />
                    </a>
                )}
            </div>

            {/* Image */}
            <div className="relative flex flex-1 items-center justify-center overflow-hidden">
                {current ? (
                    <img
                        key={current.id}
                        src={imageUrl(current.filePath)}
                        alt=""
                        className="max-h-full max-w-full object-contain"
                        draggable={false}
                    />
                ) : (
                    <span className="text-sm text-white/40">이미지를 찾을 수 없습니다.</span>
                )}

                {currentIndex > 0 && (
                    <button
                        type="button"
                        className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                        onClick={goPrev}
                        aria-label="이전 이미지"
                    >
                        <ChevronLeft className="h-6 w-6" />
                    </button>
                )}
                {currentIndex < images.length - 1 && (
                    <button
                        type="button"
                        className="absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                        onClick={goNext}
                        aria-label="다음 이미지"
                    >
                        <ChevronRight className="h-6 w-6" />
                    </button>
                )}
            </div>

            {/* Thumbnail strip */}
            {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto px-4 py-3">
                    {images.map((img, i) => (
                        <button
                            key={img.id}
                            type="button"
                            onClick={() => goTo(img)}
                            className={`relative h-14 w-10 shrink-0 overflow-hidden rounded transition-opacity ${
                                i === currentIndex
                                    ? 'ring-2 ring-white opacity-100'
                                    : 'opacity-50 hover:opacity-80'
                            }`}
                        >
                            <img
                                src={imageUrl(img.thumbnailPath ?? img.filePath)}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
