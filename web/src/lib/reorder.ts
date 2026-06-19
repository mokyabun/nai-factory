import { arrayMove } from '@dnd-kit/sortable'

export type OrderPatch = {
    id: number
    prevId: number | null
    nextId: number | null
}

export function reorderById<T extends { id: number }>(
    items: T[],
    activeId: number,
    overId: number,
): { items: T[]; orderPatch: OrderPatch } | null {
    if (activeId === overId) return null

    const oldIndex = items.findIndex((item) => item.id === activeId)
    const newIndex = items.findIndex((item) => item.id === overId)

    if (oldIndex === -1 || newIndex === -1) return null

    const nextItems = arrayMove(items, oldIndex, newIndex)

    return {
        items: nextItems,
        orderPatch: {
            id: activeId,
            prevId: newIndex > 0 ? nextItems[newIndex - 1].id : null,
            nextId: newIndex < nextItems.length - 1 ? nextItems[newIndex + 1].id : null,
        },
    }
}
