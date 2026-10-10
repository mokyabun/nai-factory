import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import { rectSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import type { EnqueuePosition, ProjectSettings, SceneSummary } from '@nai-factory/shared'
import type { PointerEvent } from 'react'

import { type OrderPatch, reorderById } from '@/lib/reorder'

import type { SceneSelectionActions } from './scene-card-menu'
import { SortableSceneItem } from './sortable-scene-item'

interface SceneGridProps {
    items: SceneSummary[]
    selectedIds: Set<number>
    selectMode: boolean
    processingSceneId: number | null
    slideshowCount: number
    cardSize: ProjectSettings['sceneCardSize']
    selectionActions: SceneSelectionActions | null
    onEnqueueScene: (sceneId: number, position: EnqueuePosition) => void
    onReorder: (items: SceneSummary[], patch: OrderPatch) => void
    onToggleSelect: (id: number) => void
    onSelectDragStart: (index: number, selected: boolean) => void
    onSelectDragEnter: (index: number) => void
    onGridPointerDown: (event: PointerEvent<HTMLDivElement>) => void
}

/** Sortable scene cards; dragging on empty space starts a range selection instead. */
export function SceneGrid({
    items,
    selectedIds,
    selectMode,
    processingSceneId,
    slideshowCount,
    cardSize,
    selectionActions,
    onEnqueueScene,
    onReorder,
    onToggleSelect,
    onSelectDragStart,
    onSelectDragEnter,
    onGridPointerDown,
}: SceneGridProps) {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const activeId = Number(active.id)
        const overId = Number(over.id)
        if (!Number.isFinite(activeId) || !Number.isFinite(overId)) return

        const reordered = reorderById(items, activeId, overId)
        if (reordered) onReorder(reordered.items, reordered.orderPatch)
    }

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((s) => s.id)} strategy={rectSortingStrategy}>
                <div
                    className="flex min-h-0 flex-1 flex-wrap content-start gap-4 pb-4"
                    onPointerDown={onGridPointerDown}
                >
                    {items.map((scene, index) => (
                        <SortableSceneItem
                            key={scene.id}
                            scene={scene}
                            index={index}
                            selected={selectedIds.has(scene.id)}
                            selectMode={selectMode}
                            isProcessing={scene.id === processingSceneId}
                            slideshowCount={slideshowCount}
                            cardSize={cardSize}
                            selectionActions={selectionActions}
                            onEnqueueScene={onEnqueueScene}
                            onToggleSelect={onToggleSelect}
                            onSelectDragStart={onSelectDragStart}
                            onSelectDragEnter={onSelectDragEnter}
                        />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    )
}
