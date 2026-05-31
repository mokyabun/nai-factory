import type { Image } from '@nai-factory/shared'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ChevronLeft, ChevronRight, Copy, Download, Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { api, imageUrl } from '@/lib/api'
import { qk } from '@/lib/queries'

export const Route = createFileRoute('/scene/$sceneId/images/$imageId')({
    component: ImageViewerPage,
})

function ImageViewerPage() {
    const { sceneId, imageId } = Route.useParams()
    const navigate = useNavigate()
    const scenId = Number(sceneId)
    const [metadataOpen, setMetadataOpen] = useState(false)

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
            if (metadataOpen && e.key === 'Escape') {
                setMetadataOpen(false)
                return
            }
            if (e.key === 'ArrowLeft') goPrev()
            else if (e.key === 'ArrowRight') goNext()
            else if (e.key === 'Escape')
                navigate({ to: '/scene/$sceneId/images', params: { sceneId }, replace: true })
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [goPrev, goNext, navigate, sceneId, metadataOpen])

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 py-3">
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-white/70 hover:bg-white/10 hover:text-white"
                    onClick={() =>
                        navigate({
                            to: '/scene/$sceneId/images',
                            params: { sceneId },
                            replace: true,
                        })
                    }
                    aria-label="이미지 목록으로 돌아가기"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>

                <span className="text-sm text-white/60">
                    {currentIndex + 1} / {images.length}
                </span>

                <div className="flex items-center gap-1">
                    {current && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-white/70 hover:bg-white/10 hover:text-white"
                            onClick={() => setMetadataOpen(true)}
                            aria-label="메타데이터 보기"
                        >
                            <Info className="h-5 w-5" />
                        </Button>
                    )}
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
            <ImageMetadataSheet
                image={current}
                open={metadataOpen}
                onOpenChange={setMetadataOpen}
            />
        </div>
    )
}

function ImageMetadataSheet({
    image,
    open,
    onOpenChange,
}: {
    image: Image | null
    open: boolean
    onOpenChange: (open: boolean) => void
}) {
    const metadata = image?.metadata ?? {}
    const parameters = readRecord(metadata.parameters)
    const characterPrompts = readArray(metadata.characterPrompts)
    const vibeTransfers = readArray(metadata.vibeTransfers)
    const characterReferences = readArray(metadata.characterReferences)
    const prompt = readString(metadata.prompt)
    const negativePrompt = readString(metadata.negativePrompt)

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[min(440px,100vw)] sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>이미지 메타데이터</SheetTitle>
                    <SheetDescription>
                        {image ? `Image #${image.id}` : '이미지를 찾을 수 없습니다.'}
                    </SheetDescription>
                </SheetHeader>

                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0">
                    <MetadataSection title="Prompt">
                        <CopyBlock value={prompt} />
                    </MetadataSection>

                    <MetadataSection title="Negative Prompt">
                        <CopyBlock value={negativePrompt} />
                    </MetadataSection>

                    <MetadataSection title="Parameters">
                        <div className="grid grid-cols-2 gap-2">
                            <MetadataValue label="model" value={readString(parameters.model)} />
                            <MetadataValue label="seed" value={readPrimitive(parameters.seed)} />
                            <MetadataValue label="size" value={formatSize(parameters)} />
                            <MetadataValue label="steps" value={readPrimitive(parameters.steps)} />
                            <MetadataValue
                                label="guidance"
                                value={readPrimitive(parameters.promptGuidance)}
                            />
                            <MetadataValue
                                label="rescale"
                                value={readPrimitive(parameters.promptGuidanceRescale)}
                            />
                            <MetadataValue label="sampler" value={readString(parameters.sampler)} />
                            <MetadataValue
                                label="noise"
                                value={readString(parameters.noiseSchedule)}
                            />
                        </div>
                    </MetadataSection>

                    <MetadataSection title="References">
                        <div className="grid grid-cols-2 gap-2">
                            <MetadataValue
                                label="character prompts"
                                value={String(characterPrompts.length)}
                            />
                            <MetadataValue
                                label="vibe transfers"
                                value={String(vibeTransfers.length)}
                            />
                            <MetadataValue
                                label="character refs"
                                value={String(characterReferences.length)}
                            />
                            <MetadataValue
                                label="generated"
                                value={formatDate(readString(metadata.generatedAt))}
                            />
                        </div>
                    </MetadataSection>

                    {characterPrompts.length > 0 && (
                        <MetadataSection title="Character Prompts">
                            <pre className="max-h-48 overflow-auto rounded border bg-muted p-2 text-[11px] leading-relaxed">
                                {JSON.stringify(characterPrompts, null, 2)}
                            </pre>
                        </MetadataSection>
                    )}

                    <MetadataSection title="Raw JSON">
                        <pre className="max-h-72 overflow-auto rounded border bg-muted p-2 text-[11px] leading-relaxed">
                            {JSON.stringify(metadata, null, 2)}
                        </pre>
                    </MetadataSection>
                </div>
            </SheetContent>
        </Sheet>
    )
}

function MetadataSection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium">{title}</h3>
            {children}
        </section>
    )
}

function MetadataValue({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0 rounded border bg-background/40 p-2">
            <div className="truncate text-[10px] text-muted-foreground">{label}</div>
            <div className="mt-1 break-words font-mono text-[11px]">{value || '-'}</div>
        </div>
    )
}

function CopyBlock({ value }: { value: string }) {
    async function copy() {
        if (!value) return
        await navigator.clipboard.writeText(value)
    }

    return (
        <div className="rounded border bg-background/40">
            <div className="flex items-center justify-end border-b p-1">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5"
                    onClick={copy}
                    disabled={!value}
                >
                    <Copy className="h-3.5 w-3.5" />
                    복사
                </Button>
            </div>
            <pre className="max-h-44 overflow-auto whitespace-pre-wrap p-2 text-[11px] leading-relaxed">
                {value || '-'}
            </pre>
        </div>
    )
}

function readRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {}
}

function readArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : []
}

function readString(value: unknown): string {
    return typeof value === 'string' ? value : ''
}

function readPrimitive(value: unknown): string {
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    return ''
}

function formatSize(parameters: Record<string, unknown>) {
    const width = readPrimitive(parameters.width)
    const height = readPrimitive(parameters.height)
    return width && height ? `${width} x ${height}` : ''
}

function formatDate(value: string) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString()
}
