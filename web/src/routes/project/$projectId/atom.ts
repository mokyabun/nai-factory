import { atom } from 'jotai'
import type { SceneSummary } from '@/lib/api'
import { type OrderPatch, reorderById } from '@/lib/reorder'

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
): { items: SceneSummary[]; orderPatch: OrderPatch } | null {
    return reorderById(items, activeId, overId)
}
