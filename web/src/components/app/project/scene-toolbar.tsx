import type { EnqueuePosition } from '@nai-factory/shared'
import { Archive, Check, Download, ListPlus, Plus, Settings, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ProjectPageDialog } from '@/routes/project/$projectId/atom'

interface SceneToolbarProps {
    sceneCount: number
    hasScenes: boolean
    selectMode: boolean
    selectedCount: number
    projectLoaded: boolean
    enqueuePending: boolean
    deletePending: boolean
    onSelectAll: () => void
    onClearSelection: () => void
    onEnqueue: (position: EnqueuePosition) => void
    onOpenDialog: (dialog: NonNullable<ProjectPageDialog>) => void
}

function ToolbarIconButton({
    label,
    disabled,
    onClick,
    children,
}: {
    label: string
    disabled: boolean
    onClick: () => void
    children: React.ReactNode
}) {
    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label={label}
                        onClick={onClick}
                        disabled={disabled}
                    />
                }
            >
                {children}
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    )
}

/** Selection actions on the left, project actions on the right. */
export function SceneToolbar({
    sceneCount,
    hasScenes,
    selectMode,
    selectedCount,
    projectLoaded,
    enqueuePending,
    deletePending,
    onSelectAll,
    onClearSelection,
    onEnqueue,
    onOpenDialog,
}: SceneToolbarProps) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
                {hasScenes && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={onSelectAll}
                        disabled={selectedCount === sceneCount}
                    >
                        <Check className="h-4 w-4" />
                        전체 선택
                    </Button>
                )}
                {selectMode && (
                    <>
                        <span className="text-xs font-medium text-muted-foreground">
                            {selectedCount}개 선택
                        </span>
                        <Button
                            size="sm"
                            className="gap-1.5"
                            onClick={() => onEnqueue('front')}
                            disabled={enqueuePending}
                        >
                            <ListPlus className="h-4 w-4" />
                            앞으로 추가
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => onEnqueue('back')}
                            disabled={enqueuePending}
                        >
                            <ListPlus className="h-4 w-4" />
                            뒤로 추가
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => onOpenDialog({ type: 'delete-selected' })}
                            disabled={deletePending}
                        >
                            <Trash2 className="h-4 w-4" />
                            선택 삭제
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5"
                            onClick={onClearSelection}
                        >
                            <X className="h-4 w-4" />
                            해제
                        </Button>
                    </>
                )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <ToolbarIconButton
                    label="Stash"
                    disabled={!projectLoaded}
                    onClick={() => onOpenDialog({ type: 'stash' })}
                >
                    <Archive className="h-4 w-4" />
                </ToolbarIconButton>
                <ToolbarIconButton
                    label="프로젝트 설정"
                    disabled={!projectLoaded}
                    onClick={() => onOpenDialog({ type: 'settings' })}
                >
                    <Settings className="h-4 w-4" />
                </ToolbarIconButton>
                <ToolbarIconButton
                    label="Export"
                    disabled={!projectLoaded}
                    onClick={() => onOpenDialog({ type: 'export' })}
                >
                    <Download className="h-4 w-4" />
                </ToolbarIconButton>
                <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => onOpenDialog({ type: 'create-scene' })}
                >
                    <Plus className="h-4 w-4" />새 씬
                </Button>
            </div>
        </div>
    )
}
