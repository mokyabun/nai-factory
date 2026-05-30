import { arrayMove } from '@dnd-kit/sortable'
import { atom } from 'jotai'
import type { SceneSummary } from '@/lib/api'

export type SceneOrderPatch = {
    id: number
    prevId: number | null
    nextId: number | null
}

export type ProjectPageDialog =
    | { type: 'create-scene' }
    | { type: 'delete-selected' }
    | { type: 'export' }
    | null

export const sceneItemsAtom = atom<SceneSummary[]>([])
export const selectedSceneIdsSetAtom = atom<Set<number>>(new Set<number>())
export const projectPageDialogAtom = atom<ProjectPageDialog>(null)
export const loadedProjectIdAtom = atom<number | null>(null)
export const slideshowImageCountAtom = atom(4)

export const selectedSceneIdsAtom = atom((get) => {
    const selectedIds = get(selectedSceneIdsSetAtom)
    return get(sceneItemsAtom)
        .filter((scene) => selectedIds.has(scene.id))
        .map((scene) => scene.id)
})

export const selectedSceneCountAtom = atom((get) => get(selectedSceneIdsAtom).length)
export const selectModeAtom = atom((get) => get(selectedSceneCountAtom) > 0)
export const hasScenesAtom = atom((get) => get(sceneItemsAtom).length > 0)

export function reorderSceneItems(
    items: SceneSummary[],
    activeId: number,
    overId: number,
): { items: SceneSummary[]; orderPatch: SceneOrderPatch } | null {
    if (activeId === overId) return null

    const oldIndex = items.findIndex((scene) => scene.id === activeId)
    const newIndex = items.findIndex((scene) => scene.id === overId)

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
