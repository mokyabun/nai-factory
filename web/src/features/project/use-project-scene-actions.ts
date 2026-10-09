import type { EnqueuePosition, SceneSummary } from '@nai-factory/shared'

import type { OrderPatch } from '@/lib/reorder'

import { useSceneMutations } from './use-scene-mutations'

export interface ProjectPageCallbacks {
    /** Clears the scene selection and returns how to restore it. */
    takeSelection: () => () => void
    closeDialog: () => void
}

/**
 * Scene actions of the project page: the shared scene mutations plus the page's own state.
 * Queueing and deleting clear the selection, and restore it when the request fails.
 */
export function useProjectSceneActions(
    projectId: number,
    { takeSelection, closeDialog }: ProjectPageCallbacks,
) {
    const mutations = useSceneMutations(projectId)

    function restoreOnError() {
        return { onError: takeSelection() }
    }

    return {
        createScene: (name: string) => mutations.create.mutate(name, { onSuccess: closeDialog }),
        moveScene: (items: SceneSummary[], patch: OrderPatch) =>
            mutations.move.mutate({ ...patch, items }),
        enqueueScenes: (sceneIds: number[], position: EnqueuePosition) =>
            mutations.enqueue.mutate({ sceneIds, position }, restoreOnError()),
        deleteScenes: (sceneIds: number[]) => {
            closeDialog()
            mutations.remove.mutate(sceneIds, restoreOnError())
        },
        enqueuePending: mutations.enqueue.isPending,
        deletePending: mutations.remove.isPending,
    }
}
