import type { EnqueuePosition } from '@nai-factory/shared'
import { ChevronDown, ListPlus, ListX, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { ToolbarIconButton } from './toolbar-icon-button'

interface SceneSelectionBarProps {
    sceneCount: number
    selectedCount: number
    selectedQueueCount: number
    enqueuePending: boolean
    clearQueuePending: boolean
    deletePending: boolean
    onSelectAll: () => void
    onClearSelection: () => void
    onEnqueue: (position: EnqueuePosition) => void
    onClearQueue: () => void
    onDelete: () => void
}

export function SceneSelectionBar({
    sceneCount,
    selectedCount,
    selectedQueueCount,
    enqueuePending,
    clearQueuePending,
    deletePending,
    onSelectAll,
    onClearSelection,
    onEnqueue,
    onClearQueue,
    onDelete,
}: SceneSelectionBarProps) {
    return (
        <div className="flex min-h-10 min-w-0 flex-1 basis-xl flex-wrap items-center justify-between gap-x-2 gap-y-1 border border-primary/40 bg-primary/10 px-1 py-0.5">
            <div className="flex items-center gap-1">
                <ToolbarIconButton label="선택 해제" variant="ghost" onClick={onClearSelection}>
                    <X />
                </ToolbarIconButton>
                <span className="px-1 text-sm font-medium tabular-nums">
                    {selectedCount}개 선택
                </span>
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={onSelectAll}
                    disabled={selectedCount === sceneCount}
                >
                    전체 선택
                </Button>
            </div>
            <div className="ml-auto flex items-center gap-2">
                <div className="flex">
                    <Button size="sm" onClick={() => onEnqueue('back')} disabled={enqueuePending}>
                        <ListPlus />큐 추가
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={
                                <Button
                                    size="icon-sm"
                                    className="border-l-primary-foreground/25"
                                    aria-label="큐 추가 위치 선택"
                                    disabled={enqueuePending}
                                />
                            }
                        >
                            <ChevronDown />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEnqueue('front')}>
                                맨 앞에 추가
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEnqueue('back')}>
                                맨 뒤에 추가
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onClearQueue}
                    disabled={clearQueuePending || selectedQueueCount === 0}
                >
                    <ListX />큐 삭제
                    {selectedQueueCount > 0 && (
                        <span className="tabular-nums text-muted-foreground">
                            {selectedQueueCount}
                        </span>
                    )}
                </Button>
                <div className="h-5 w-px bg-border" />
                <ToolbarIconButton
                    label="선택 삭제"
                    variant="destructive"
                    onClick={onDelete}
                    disabled={deletePending}
                >
                    <Trash2 />
                </ToolbarIconButton>
            </div>
        </div>
    )
}
