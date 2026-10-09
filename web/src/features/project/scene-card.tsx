import type { EnqueuePosition, ProjectSettings, SceneSummary } from '@nai-factory/shared'
import { useNavigate } from '@tanstack/react-router'
import { Check, Copy, Image, ListPlus, Loader, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog'
import { Button } from '@/components/ui/button'
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ImageProgressBar } from '@/features/queue/generation-progress'
import { formatSeconds } from '@/features/queue/generation-timing'
import { useGenerationStatus } from '@/features/queue/use-queue'
import { assetUrl } from '@/lib/api'
import { cn } from '@/lib/utils'

import { useSceneMutations } from './use-scene-mutations'

interface SceneCardProps {
    scene: SceneSummary
    index: number
    selected?: boolean
    selectMode?: boolean
    isProcessing?: boolean
    slideshowCount?: number
    cardSize?: ProjectSettings['sceneCardSize']
    onToggleSelect?: (id: number) => void
    onSelectDragStart?: (index: number, selected: boolean) => void
}

const SCENE_CARD_SIZE_CLASSES: Record<ProjectSettings['sceneCardSize'], string> = {
    sm: 'w-44',
    md: 'w-56',
    lg: 'w-72',
}

const SCENE_CARD_EMPTY_ICON_CLASSES: Record<ProjectSettings['sceneCardSize'], string> = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
}

export function SceneCard({
    scene,
    index,
    selected = false,
    selectMode = false,
    isProcessing = false,
    slideshowCount = 4,
    cardSize = 'md',
    onToggleSelect,
    onSelectDragStart,
}: SceneCardProps) {
    const navigate = useNavigate()

    const queueCount = scene.queueCount ?? 0
    const inQueue = queueCount > 0
    const images = scene.latestImages ?? []
    const cycleImages = images.slice(0, slideshowCount)

    const [slideshowTick, setSlideshowTick] = useState(0)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const currentThumbIndex = cycleImages.length > 1 ? slideshowTick % cycleImages.length : 0

    useEffect(() => {
        if (cycleImages.length <= 1) return
        const interval = setInterval(() => setSlideshowTick((tick) => tick + 1), 2000)
        return () => clearInterval(interval)
    }, [cycleImages.length])

    const currentThumbImg = cycleImages[currentThumbIndex] ?? null

    const { remove, duplicate, enqueue, clearQueue } = useSceneMutations(scene.projectId)
    const enqueueScene = (position: EnqueuePosition) =>
        enqueue.mutate({ sceneIds: [scene.id], position })

    return (
        <>
            <ContextMenu>
                <ContextMenuTrigger
                    render={
                        <div
                            className={cn(
                                'group/scene-card relative flex flex-col overflow-hidden rounded-lg border bg-card transition-all hover:shadow-md',
                                SCENE_CARD_SIZE_CLASSES[cardSize],
                                inQueue &&
                                    'border-primary shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary)_30%,transparent)]',
                                selected && 'ring-2 ring-primary ring-offset-2',
                            )}
                        />
                    }
                >
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    aria-label={`${scene.name} 메뉴 열기`}
                                    className="pointer-events-none absolute top-1.5 right-1.5 z-30 rounded bg-black/35 text-white opacity-0 shadow-sm hover:bg-black/55 hover:text-white group-hover/scene-card:pointer-events-auto group-hover/scene-card:opacity-100 aria-expanded:pointer-events-auto aria-expanded:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100"
                                    onPointerDown={(e) => e.stopPropagation()}
                                />
                            }
                        >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={6}>
                            <DropdownMenuItem
                                onClick={() => enqueueScene('front')}
                                disabled={enqueue.isPending}
                            >
                                <ListPlus className="mr-2 h-4 w-4" />큐 맨 앞 추가
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => duplicate.mutate(scene)}
                                disabled={duplicate.isPending}
                            >
                                <Copy className="mr-2 h-4 w-4" />
                                복제
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteOpen(true)}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                삭제
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Selection checkbox */}
                    {onToggleSelect && (
                        <button
                            type="button"
                            aria-label={selected ? `${scene.name} 선택 해제` : `${scene.name} 선택`}
                            className={cn(
                                'pointer-events-none absolute top-1.5 left-1.5 z-20 flex h-6 w-6 items-center justify-center rounded border-2 opacity-0 after:absolute after:-inset-2 shadow-sm transition-all group-hover/scene-card:pointer-events-auto group-hover/scene-card:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100',
                                selected
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-white/75 bg-black/35 text-transparent hover:border-primary hover:bg-primary hover:text-primary-foreground',
                            )}
                            onClick={(e) => {
                                e.stopPropagation()
                                if (onSelectDragStart && e.detail > 0) return
                                onToggleSelect(scene.id)
                            }}
                            onPointerDown={(e) => {
                                if (!onSelectDragStart || e.button !== 0) return
                                e.preventDefault()
                                e.stopPropagation()
                                onSelectDragStart(index, selected)
                            }}
                        >
                            <Check className="h-3 w-3" />
                        </button>
                    )}

                    {/* Image area */}
                    <button
                        type="button"
                        className="group/thumb relative aspect-[3/4] w-full overflow-hidden bg-muted text-left"
                        onClick={() => {
                            if (selectMode && onToggleSelect) {
                                onToggleSelect(scene.id)
                                return
                            }

                            void navigate({
                                to: '/scene/$sceneId/images',
                                params: { sceneId: String(scene.id) },
                            })
                        }}
                    >
                        {currentThumbImg === null ? (
                            <div className="flex h-full items-center justify-center">
                                <Image
                                    className={cn(
                                        'text-muted-foreground/20',
                                        SCENE_CARD_EMPTY_ICON_CLASSES[cardSize],
                                    )}
                                />
                            </div>
                        ) : (
                            <img
                                key={currentThumbIndex}
                                src={assetUrl(currentThumbImg.thumbAssetId)}
                                alt={scene.name}
                                className="h-full w-full object-cover transition-transform duration-200 group-hover/thumb:scale-105"
                                loading="lazy"
                            />
                        )}

                        {/* Bottom overlay */}
                        <div className="absolute right-0 bottom-0 left-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/65 to-transparent px-1.5 pt-8 pb-1.5">
                            <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                                {(inQueue || isProcessing) && (
                                    <div className="flex flex-wrap items-center gap-1">
                                        {isProcessing && <SceneCardGeneratingBadge />}
                                        {inQueue && (
                                            <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] leading-none font-semibold text-primary-foreground shadow">
                                                큐 {queueCount}
                                            </span>
                                        )}
                                    </div>
                                )}
                                <span className="max-w-full truncate text-[10px] font-medium text-white/90">
                                    {scene.name}
                                </span>
                            </div>

                            {cycleImages.length > 1 && (
                                <div className="flex shrink-0 gap-1">
                                    {cycleImages.map((_, i) => (
                                        <div
                                            // dots are positional decorations for the slideshow.
                                            key={i}
                                            className={cn(
                                                'h-1 w-1 rounded-full transition-colors',
                                                i === currentThumbIndex
                                                    ? 'bg-white'
                                                    : 'bg-white/35',
                                            )}
                                        />
                                    ))}
                                </div>
                            )}

                            <span className="shrink-0 text-[10px] font-medium text-white/90">
                                {(scene.imageCount ?? 0) > 0 ? `${scene.imageCount}장` : ''}
                            </span>
                        </div>

                        {/* Keep the image visible while generating; progress runs along the bottom edge. */}
                        {isProcessing && <SceneCardGenerationBar />}
                    </button>

                    {/* Actions */}
                    <div className="flex border-t">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="min-w-0 flex-1 shrink basis-0 gap-1 rounded-none px-1 text-xs"
                            aria-label="큐 추가"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => enqueueScene('back')}
                            disabled={enqueue.isPending}
                        >
                            <ListPlus className="h-3.5 w-3.5" />
                            <span className={cn('truncate', cardSize === 'sm' && 'sr-only')}>
                                큐 추가
                            </span>
                        </Button>
                        <div className="w-px bg-border" />
                        <Button
                            variant="ghost"
                            size="sm"
                            className="min-w-0 flex-1 shrink basis-0 gap-1 rounded-none px-1 text-xs text-muted-foreground hover:text-destructive"
                            aria-label="큐 삭제"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => clearQueue.mutate(scene)}
                            disabled={clearQueue.isPending || !inQueue}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className={cn('truncate', cardSize === 'sm' && 'sr-only')}>
                                큐 삭제
                            </span>
                        </Button>
                        <div className="w-px bg-border" />
                        <Button
                            variant="ghost"
                            size="sm"
                            className="min-w-0 flex-1 shrink basis-0 gap-1 rounded-none px-1 text-xs"
                            aria-label="수정"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() =>
                                navigate({
                                    to: '/scene/$sceneId',
                                    params: { sceneId: String(scene.id) },
                                })
                            }
                        >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className={cn('truncate', cardSize === 'sm' && 'sr-only')}>
                                수정
                            </span>
                        </Button>
                    </div>
                </ContextMenuTrigger>

                <ContextMenuContent>
                    <ContextMenuItem
                        onClick={() => enqueueScene('front')}
                        disabled={enqueue.isPending}
                    >
                        <ListPlus className="mr-2 h-4 w-4" />큐 맨 앞 추가
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                        onClick={() => duplicate.mutate(scene)}
                        disabled={duplicate.isPending}
                    >
                        <Copy className="mr-2 h-4 w-4" />
                        복제
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteOpen(true)}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        삭제
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>

            <ConfirmDeleteDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title="씬 삭제"
                description={`"${scene.name}" 씬과 모든 생성된 이미지를 삭제합니다. 되돌릴 수 없습니다.`}
                onConfirm={() => remove.mutate([scene.id])}
            />
        </>
    )
}

/** Rendered only on the card being generated, so just that card ticks with the clock. */
function SceneCardGeneratingBadge() {
    const { progress } = useGenerationStatus()

    return (
        <span className="flex items-center gap-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] leading-none font-semibold text-foreground tabular-nums shadow">
            <Loader className="h-2.5 w-2.5 animate-spin motion-reduce:animate-none" />
            생성 중{progress ? ` · ${formatSeconds(progress.elapsedMs / 1000)}` : ''}
        </span>
    )
}

function SceneCardGenerationBar() {
    const { progress } = useGenerationStatus()

    return (
        <ImageProgressBar
            progress={progress}
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-black/30"
        />
    )
}
