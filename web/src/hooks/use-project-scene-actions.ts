import type { EnqueuePosition, SceneSummary } from '@nai-factory/shared'
import { useAtom, useSetAtom } from 'jotai'

import type { OrderPatch } from '@/lib/reorder'
import {
    projectPageDialogAtom,
    sceneItemsAtom,
    selectedSceneIdsSetAtom,
} from '@/routes/project/$projectId/atom'

import { useSceneMutations } from './use-scene-mutations'

/**
 * Scene actions of the project page: the shared scene mutations plus the page's own state.
 * Queueing and deleting clear the selection, and restore it when the request fails.
 */
export function useProjectSceneActions(projectId: number) {
    const mutations = useSceneMutations(projectId)
    const setItems = useSetAtom(sceneItemsAtom)
    const [selectedIds, setSelectedIds] = useAtom(selectedSceneIdsSetAtom)
    const setProjectDialog = useSetAtom(projectPageDialogAtom)

    function clearSelection() {
        const previous = selectedIds
        setSelectedIds(new Set<number>())
        return { onError: () => setSelectedIds(previous) }
    }

    return {
        createScene: (name: string) =>
            mutations.create.mutate(name, { onSuccess: () => setProjectDialog(null) }),
        // The local list follows the drag right away; the cache follows in the mutation.
        moveScene: (items: SceneSummary[], patch: OrderPatch) => {
            setItems(items)
            mutations.move.mutate({ ...patch, items })
        },
        enqueueScenes: (sceneIds: number[], position: EnqueuePosition) =>
            mutations.enqueue.mutate({ sceneIds, position }, clearSelection()),
        deleteScenes: (sceneIds: number[]) => {
            setProjectDialog(null)
            mutations.remove.mutate(sceneIds, clearSelection())
        },
        enqueuePending: mutations.enqueue.isPending,
        deletePending: mutations.remove.isPending,
    }
}
