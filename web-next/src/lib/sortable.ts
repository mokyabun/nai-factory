export function arrayMove<T>(items: T[], from: number, to: number): T[] {
    const next = [...items]
    const [item] = next.splice(from, 1)
    if (item === undefined) return items
    next.splice(to, 0, item)
    return next
}

export function movedIds<T extends { id: number }>(
    items: T[],
    sourceId: number,
    targetId: number,
): { items: T[]; prevId: number | null; nextId: number | null } | null {
    const from = items.findIndex((item) => item.id === sourceId)
    const to = items.findIndex((item) => item.id === targetId)
    if (from < 0 || to < 0 || from === to) return null

    const next = arrayMove(items, from, to)
    return {
        items: next,
        prevId: to > 0 ? next[to - 1].id : null,
        nextId: to < next.length - 1 ? next[to + 1].id : null,
    }
}
