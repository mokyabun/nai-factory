import type { EnqueuePosition } from '@nai-factory/shared'
import { Archive, Check, Download, Plus, Settings } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { SceneSelectionBar } from './scene-selection-bar'
import { ToolbarIconButton } from './toolbar-icon-button'

export type ProjectPageDialog =
    | { type: 'create-scene' }
    | { type: 'delete-selected' }
    | { type: 'export' }
    | { type: 'stash' }
    | { type: 'settings' }

interface SceneToolbarProps {
    sceneCount: number
    selectedCount: number
    selectedQueueCount: number
    imageCount: number
    selectedImageTotal: number
    projectLoaded: boolean
    enqueuePending: boolean
    clearQueuePending: boolean
    deletePending: boolean
    onSelectAll: () => void
    onClearSelection: () => void
    onImageCountChange: (count: number) => void
    onEnqueue: (position: EnqueuePosition) => void
    onClearQueue: () => void
    onOpenDialog: (dialog: ProjectPageDialog) => void
}

export function SceneToolbar({
    sceneCount,
    selectedCount,
    selectedQueueCount,
    imageCount,
    selectedImageTotal,
    projectLoaded,
    enqueuePending,
    clearQueuePending,
    deletePending,
    onSelectAll,
    onClearSelection,
    onImageCountChange,
    onEnqueue,
    onClearQueue,
    onOpenDialog,
}: SceneToolbarProps) {
    const selectMode = selectedCount > 0

    return (
        <div className="flex min-h-10 flex-wrap items-center justify-between gap-2">
            {selectMode ? (
                <SceneSelectionBar
                    sceneCount={sceneCount}
                    selectedCount={selectedCount}
                    selectedQueueCount={selectedQueueCount}
                    imageCount={imageCount}
                    selectedImageTotal={selectedImageTotal}
                    enqueuePending={enqueuePending}
                    clearQueuePending={clearQueuePending}
                    deletePending={deletePending}
                    onSelectAll={onSelectAll}
                    onClearSelection={onClearSelection}
                    onImageCountChange={onImageCountChange}
                    onEnqueue={onEnqueue}
                    onClearQueue={onClearQueue}
                    onDelete={() => onOpenDialog({ type: 'delete-selected' })}
                />
            ) : (
                <div>
                    {sceneCount > 0 && (
                        <Button variant="outline" size="sm" onClick={onSelectAll}>
                            <Check />
                            전체 선택
                        </Button>
                    )}
                </div>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-2">
                <ToolbarIconButton
                    label="Stash"
                    disabled={!projectLoaded}
                    onClick={() => onOpenDialog({ type: 'stash' })}
                >
                    <Archive />
                </ToolbarIconButton>
                <ToolbarIconButton
                    label="프로젝트 설정"
                    disabled={!projectLoaded}
                    onClick={() => onOpenDialog({ type: 'settings' })}
                >
                    <Settings />
                </ToolbarIconButton>
                <ToolbarIconButton
                    label="Export"
                    disabled={!projectLoaded}
                    onClick={() => onOpenDialog({ type: 'export' })}
                >
                    <Download />
                </ToolbarIconButton>
                {!selectMode && (
                    <Button size="sm" onClick={() => onOpenDialog({ type: 'create-scene' })}>
                        <Plus />새 씬
                    </Button>
                )}
            </div>
        </div>
    )
}
