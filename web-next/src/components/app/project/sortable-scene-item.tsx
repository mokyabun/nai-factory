import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripHorizontal } from 'lucide-react'
import type { SceneSummary } from '@/lib/api'
import { SceneCard } from './scene-card'

interface SortableSceneItemProps {
    scene: SceneSummary
    selected: boolean
    selectMode: boolean
    isProcessing: boolean
    slideshowCount: number
    onToggleSelect: (id: number) => void
}

export function SortableSceneItem({
    scene,
    selected,
    selectMode,
    isProcessing,
    slideshowCount,
    onToggleSelect,
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
            className={`group relative ${isDragging ? 'opacity-40' : ''}`}
        >
            <SceneCard
                scene={scene}
                selected={selected}
                selectMode={selectMode}
                isProcessing={isProcessing}
                slideshowCount={slideshowCount}
                onToggleSelect={onToggleSelect}
            />

            {/* Drag handle */}
            <div
                {...attributes}
                {...listeners}
                className="absolute left-1/2 top-1 z-30 flex -translate-x-1/2 cursor-grab items-center justify-center rounded bg-black/50 px-2 py-0.5 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
            >
                <GripHorizontal className="h-3.5 w-3.5 text-white" />
            </div>
        </div>
    )
}
