import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { EnqueuePosition, ProjectSettings, SceneSummary } from '@nai-factory/shared'
import { GripHorizontal } from 'lucide-react'

import { SceneCard } from './scene-card'
import type { SceneSelectionActions } from './scene-card-menu'

interface SortableSceneItemProps {
    scene: SceneSummary
    index: number
    selected: boolean
    selectMode: boolean
    isProcessing: boolean
    slideshowCount: number
    cardSize: ProjectSettings['sceneCardSize']
    thumbAspectRatio: number
    selectionActions: SceneSelectionActions | null
    onEnqueueScene: (sceneId: number, position: EnqueuePosition) => void
    onToggleSelect: (id: number) => void
    onSelectDragStart: (index: number, selected: boolean) => void
    onSelectDragEnter: (index: number) => void
}

export function SortableSceneItem({
    scene,
    index,
    selected,
    selectMode,
    isProcessing,
    slideshowCount,
    cardSize,
    thumbAspectRatio,
    selectionActions,
    onEnqueueScene,
    onToggleSelect,
    onSelectDragStart,
    onSelectDragEnter,
}: SortableSceneItemProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
        id: scene.id,
        animateLayoutChanges: () => false,
    })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: 'none',
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group/scene-item relative ${isDragging ? 'opacity-40' : ''}`}
            onPointerEnter={() => onSelectDragEnter(index)}
        >
            <SceneCard
                scene={scene}
                index={index}
                selected={selected}
                selectMode={selectMode}
                isProcessing={isProcessing}
                slideshowCount={slideshowCount}
                cardSize={cardSize}
                thumbAspectRatio={thumbAspectRatio}
                selectionActions={selectionActions}
                onEnqueue={(position) => onEnqueueScene(scene.id, position)}
                onToggleSelect={onToggleSelect}
                onSelectDragStart={onSelectDragStart}
            />

            <div
                {...attributes}
                {...listeners}
                className="pointer-events-none absolute top-1 left-1/2 z-30 flex -translate-x-1/2 cursor-grab items-center justify-center rounded bg-black/50 px-3 py-1 opacity-0 transition-opacity group-hover/scene-item:pointer-events-auto group-hover/scene-item:opacity-100 active:cursor-grabbing [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100"
            >
                <GripHorizontal className="h-3.5 w-3.5 text-white" />
            </div>
        </div>
    )
}
