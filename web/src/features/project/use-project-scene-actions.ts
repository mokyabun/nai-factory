import type { EnqueuePosition, Project, SceneSummary } from '@nai-factory/shared'
import { useState } from 'react'

import type { OrderPatch } from '@/lib/reorder'

import {
    type EnqueueSummary,
    needsEnqueueConfirmation,
    summarizeSceneEnqueue,
} from './enqueue-summary'
import { type SceneEnqueueRequest, useSceneMutations } from './use-scene-mutations'

export interface ProjectPageCallbacks {
    /** Clears the scene selection and returns how to restore it. */
    takeSelection: () => () => void
    closeDialog: () => void
}

type PendingEnqueue = { request: SceneEnqueueRequest; summary: EnqueueSummary }

/** Queueing, clearing queues and deleting clear the selection and restore it when the request fails. */
export function useProjectSceneActions(
    projectId: number,
    { takeSelection, closeDialog }: ProjectPageCallbacks,
    { project, scenes }: { project: Project | undefined; scenes: SceneSummary[] },
) {
    const mutations = useSceneMutations(projectId)
    const [pendingEnqueue, setPendingEnqueue] = useState<PendingEnqueue | null>(null)

    function restoreOnError() {
        return { onError: takeSelection() }
    }

    function summarize(sceneIds: number[], count: number) {
        const ids = new Set(sceneIds)
        return summarizeSceneEnqueue(
            scenes.filter((scene) => ids.has(scene.id)),
            count,
            project?.parameters,
        )
    }

    function enqueueScenes(sceneIds: number[], position: EnqueuePosition, count?: number) {
        const request = {
            sceneIds,
            position,
            count: count ?? project?.settings.defaultImageCount ?? 1,
        }
        const summary = summarize(sceneIds, request.count)
        if (needsEnqueueConfirmation(summary)) {
            setPendingEnqueue({ request, summary })
            return
        }
        mutations.enqueue.mutate(request, restoreOnError())
    }

    return {
        createScene: (name: string) => mutations.create.mutate(name, { onSuccess: closeDialog }),
        moveScene: (items: SceneSummary[], patch: OrderPatch) =>
            mutations.move.mutate({ ...patch, items }),
        enqueueScenes,
        summarizeEnqueue: summarize,
        enqueueConfirmation: {
            summary: pendingEnqueue?.summary ?? null,
            confirm: () => {
                if (pendingEnqueue)
                    mutations.enqueue.mutate(pendingEnqueue.request, restoreOnError())
                setPendingEnqueue(null)
            },
            cancel: () => setPendingEnqueue(null),
        },
        clearSceneQueues: (scenes: SceneSummary[]) =>
            mutations.clearQueue.mutate(scenes, restoreOnError()),
        deleteScenes: (sceneIds: number[]) => {
            closeDialog()
            mutations.remove.mutate(sceneIds, restoreOnError())
        },
        enqueuePending: mutations.enqueue.isPending,
        clearQueuePending: mutations.clearQueue.isPending,
        deletePending: mutations.remove.isPending,
    }
}
