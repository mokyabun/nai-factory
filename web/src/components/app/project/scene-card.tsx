import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Check, Copy, Image, ListPlus, Loader, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ConfirmDeleteDialog } from '@/components/app/dialogs/confirm-delete-dialog'
import { Button } from '@/components/ui/button'
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '@/components/ui/context-menu'
import type { SceneSummary } from '@/lib/api'
import { api, imageUrl } from '@/lib/api'
import { qk } from '@/lib/queries'
import { cn } from '@/lib/utils'

interface SceneCardProps {
    scene: SceneSummary
    selected?: boolean
    selectMode?: boolean
    isProcessing?: boolean
    slideshowCount?: number
    onToggleSelect?: (id: number) => void
}

export function SceneCard({
    scene,
    selected = false,
    selectMode = false,
    isProcessing = false,
    slideshowCount = 4,
    onToggleSelect,
}: SceneCardProps) {
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    const queueCount = scene.queueCount ?? 0
    const inQueue = queueCount > 0
    const images = scene.latestImages ?? []
    const cycleImages = images.slice(0, slideshowCount)

    const [currentThumbIndex, setCurrentThumbIndex] = useState(0)
    const [deleteOpen, setDeleteOpen] = useState(false)

    useEffect(() => {
        if (cycleImages.length <= 1) {
            setCurrentThumbIndex(0)
            return
        }
        const interval = setInterval(
            () => setCurrentThumbIndex((i) => (i + 1) % cycleImages.length),
            2000,
        )
        return () => clearInterval(interval)
    }, [cycleImages.length])

    const currentThumbImg = cycleImages[currentThumbIndex] ?? null

    const deleteScene = useMutation({
        mutationFn: () => api.scenes({ id: scene.id }).delete(),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.scenes(scene.projectId) }),
    })

    const duplicateScene = useMutation({
        mutationFn: () => api.scenes({ id: scene.id }).duplicate.post(),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.scenes(scene.projectId) }),
    })

    const enqueue = useMutation({
        mutationFn: (position: 'back' | 'front' = 'back') =>
            api.queue.enqueue.post({ sceneId: scene.id, position }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: qk.queueStatus() })
            queryClient.invalidateQueries({ queryKey: qk.queue(scene.projectId) })
            queryClient.invalidateQueries({ queryKey: qk.scenes(scene.projectId) })
        },
    })

    const clearQueue = useMutation({
        mutationFn: () => api.queue.delete({ query: { sceneId: scene.id } }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: qk.queueStatus() })
            queryClient.invalidateQueries({ queryKey: qk.queue(scene.projectId) })
            queryClient.invalidateQueries({ queryKey: qk.scenes(scene.projectId) })
        },
    })

    return (
        <>
            <ContextMenu>
                <ContextMenuTrigger
                    render={
                        <div
                            className={cn(
                                'relative flex w-56 flex-col overflow-hidden rounded-lg border bg-card transition-all hover:shadow-md',
                                inQueue &&
                                    'border-primary shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary)_30%,transparent)]',
                                selected && 'ring-2 ring-primary ring-offset-2',
                            )}
                        />
                    }
                >
                    {/* Queue badge */}
                    {inQueue && (
                        <div className="absolute top-1.5 right-1.5 z-20 rounded bg-primary px-1.5 py-0.5 text-[10px] leading-none font-semibold text-primary-foreground shadow">
                            큐 {queueCount}
                        </div>
                    )}

                    {/* Selection checkbox */}
                    {selectMode && onToggleSelect && (
                        <button
                            type="button"
                            className={cn(
                                'absolute top-1.5 left-1.5 z-20 flex h-5 w-5 items-center justify-center rounded border-2 transition-colors',
                                selected
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-white/70 bg-black/30 text-transparent hover:border-primary',
                            )}
                            onClick={(e) => {
                                e.stopPropagation()
                                onToggleSelect(scene.id)
                            }}
                        >
                            <Check className="h-3 w-3" />
                        </button>
                    )}

                    {/* Image area */}
                    <button
                        type="button"
                        className="group relative aspect-[3/4] w-full overflow-hidden bg-muted text-left"
                        onClick={() =>
                            navigate({
                                to: '/scene/$sceneId/images',
                                params: { sceneId: String(scene.id) },
                            })
                        }
                    >
                        {currentThumbImg === null ? (
                            <div className="flex h-full items-center justify-center">
                                <Image className="h-10 w-10 text-muted-foreground/20" />
                            </div>
                        ) : (
                            <img
                                key={currentThumbIndex}
                                src={imageUrl(
                                    currentThumbImg.thumbnailPath ?? currentThumbImg.filePath,
                                )}
                                alt={scene.name}
                                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                                loading="lazy"
                            />
                        )}

                        {/* Bottom overlay */}
                        <div className="absolute right-0 bottom-0 left-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/65 to-transparent px-1.5 pt-8 pb-1.5">
                            <span className="min-w-0 truncate text-[10px] font-medium text-white/90">
                                {scene.name}
                            </span>

                            {cycleImages.length > 1 && (
                                <div className="flex shrink-0 gap-1">
                                    {cycleImages.map((_, i) => (
                                        <div
                                            // biome-ignore lint/suspicious/noArrayIndexKey: dots are positional decorations for the slideshow.
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

                        {/* Processing overlay */}
                        {isProcessing && (
                            <div className="absolute inset-0 flex items-center justify-center bg-primary/20 backdrop-blur-[2px]">
                                <div className="flex flex-col items-center gap-1.5">
                                    <Loader className="h-7 w-7 animate-spin text-white drop-shadow" />
                                    <span className="text-[10px] font-semibold text-white drop-shadow">
                                        생성 중
                                    </span>
                                </div>
                            </div>
                        )}
                    </button>

                    {/* Actions */}
                    <div className="flex border-t">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 flex-1 gap-1 rounded-none text-xs"
                            onClick={() => enqueue.mutate('back')}
                            disabled={enqueue.isPending}
                        >
                            <ListPlus className="h-3.5 w-3.5" />큐 추가
                        </Button>
                        <div className="w-px bg-border" />
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 flex-1 gap-1 rounded-none text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => clearQueue.mutate()}
                            disabled={clearQueue.isPending || !inQueue}
                        >
                            <Trash2 className="h-3.5 w-3.5" />큐 삭제
                        </Button>
                        <div className="w-px bg-border" />
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 flex-1 gap-1 rounded-none text-xs"
                            onClick={() =>
                                navigate({
                                    to: '/scene/$sceneId',
                                    params: { sceneId: String(scene.id) },
                                })
                            }
                        >
                            <Pencil className="h-3.5 w-3.5" />
                            수정
                        </Button>
                    </div>
                </ContextMenuTrigger>

                <ContextMenuContent>
                    <ContextMenuItem
                        onClick={() => enqueue.mutate('front')}
                        disabled={enqueue.isPending}
                    >
                        <ListPlus className="mr-2 h-4 w-4" />큐 맨 앞 추가
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                        onClick={() => duplicateScene.mutate()}
                        disabled={duplicateScene.isPending}
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
                onConfirm={() => deleteScene.mutate()}
            />
        </>
    )
}
