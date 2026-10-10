import { arrayMove } from '@dnd-kit/sortable'

/** A move request: the item ends up between `beforeId` and `afterId` (null = list edge). */
export type OrderPatch = {
    id: number
    beforeId: number | null
    afterId: number | null
}

export function comparePosition<T extends { position: string; id: number }>(a: T, b: T) {
    if (a.position < b.position) return -1
    if (a.position > b.position) return 1
    return a.id - b.id
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
            beforeId: newIndex > 0 ? nextItems[newIndex - 1].id : null,
            afterId: newIndex < nextItems.length - 1 ? nextItems[newIndex + 1].id : null,
        },
    }
}
