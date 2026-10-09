import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'nai-factory.sidebar.project.collapsedGroupIds'

const listeners = new Set<() => void>()
let collapsedIds: Set<number> | null = null

function read() {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown
        if (!Array.isArray(parsed)) return new Set<number>()
        return new Set(parsed.filter((id): id is number => Number.isInteger(id) && id > 0))
    } catch {
        return new Set<number>()
    }
}

function getSnapshot() {
    collapsedIds ??= read()
    return collapsedIds
}

function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

/** Collapsed project groups, remembered in localStorage and shared by every group row. */
export function useCollapsedGroups() {
    const ids = useSyncExternalStore(subscribe, getSnapshot)

    return {
        isCollapsed: (groupId: number) => ids.has(groupId),
        setCollapsed: (groupId: number, collapsed: boolean) => {
            const next = new Set(getSnapshot())
            if (collapsed) next.add(groupId)
            else next.delete(groupId)

            collapsedIds = next
            try {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
            } catch {
                // Storage can be full or blocked; the state still holds for this session.
            }
            for (const listener of listeners) listener()
        },
    }
}
