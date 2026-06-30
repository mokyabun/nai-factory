import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripHorizontal } from 'lucide-react'
import type { SceneSummary } from '@/lib/api'
import { SceneCard } from './scene-card'

interface SortableSceneItemProps {
    scene: SceneSummary
    index: number
    selected: boolean
    selectMode: boolean
    isProcessing: boolean
    slideshowCount: number
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
    onToggleSelect,
    onSelectDragStart,
    onSelectDragEnter,
}: SortableSceneItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: scene.id,
    })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
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
                onToggleSelect={onToggleSelect}
                onSelectDragStart={onSelectDragStart}
            />

            {/* Drag handle */}
            <div
                {...attributes}
                {...listeners}
                className="pointer-events-none absolute top-1 left-1/2 z-30 flex -translate-x-1/2 cursor-grab items-center justify-center rounded bg-black/50 px-2 py-0.5 opacity-0 transition-opacity group-hover/scene-item:pointer-events-auto group-hover/scene-item:opacity-100 active:cursor-grabbing"
            >
                <GripHorizontal className="h-3.5 w-3.5 text-white" />
            </div>
        </div>
    )
}
