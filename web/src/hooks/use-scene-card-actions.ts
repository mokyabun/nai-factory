import type { EnqueuePosition, QueueStatus, SceneSummary } from '@nai-factory/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { call, contract } from '@/lib/api'
import { restoreSnapshots, snapshotQueries } from '@/lib/optimistic'
import { tempId } from '@/lib/optimistic-scenes'
import { matchesKey, qk } from '@/lib/queries'

/** Delete, duplicate and queue actions of a scene card, with optimistic list updates. */
export function useSceneCardActions(scene: SceneSummary) {
    const queryClient = useQueryClient()

    const deleteScene = useMutation({
        mutationFn: () => call(contract.scenes.delete, { params: { id: scene.id } }),
        onMutate: async () => {
            const snapshots = await snapshotQueries(queryClient, {
                predicate: (query) =>
                    query.queryKey[0] === 'jobs' ||
                    matchesKey(query.queryKey, qk.scenes.list(scene.projectId)),
            })
            queryClient.setQueryData<SceneSummary[]>(qk.scenes.list(scene.projectId), (scenes) =>
                scenes?.filter((item) => item.id !== scene.id),
            )
            return { snapshots }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshots(queryClient, context?.snapshots)
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: qk.jobs.all() })
            void queryClient.invalidateQueries({ queryKey: qk.scenes.list(scene.projectId) })
        },
    })

    const duplicateScene = useMutation({
        mutationFn: () => call(contract.scenes.duplicate, { params: { id: scene.id } }),
        onMutate: async () => {
            const snapshots = await snapshotQueries(queryClient, {
                queryKey: qk.scenes.list(scene.projectId),
            })
            const tempScene: SceneSummary = {
                ...scene,
                id: tempId(),
                name: `${scene.name} Copy`,
                imageCount: 0,
                latestImages: [],
                queueCount: 0,
            }
            queryClient.setQueryData<SceneSummary[]>(qk.scenes.list(scene.projectId), (scenes) => {
                if (!scenes) return scenes
                const index = scenes.findIndex((item) => item.id === scene.id)
                const next = [...scenes]
                next.splice(index + 1, 0, tempScene)
                return next
            })
            return { snapshots, tempId: tempScene.id }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshots(queryClient, context?.snapshots)
        },
        onSuccess: (created, _variables, context) => {
            const duplicated: SceneSummary = {
                ...created,
                imageCount: 0,
                latestImages: [],
                queueCount: 0,
            }
            queryClient.setQueryData<SceneSummary[]>(qk.scenes.list(scene.projectId), (scenes) =>
                scenes?.map((item) => (item.id === context?.tempId ? duplicated : item)),
            )
        },
        onSettled: () =>
            queryClient.invalidateQueries({ queryKey: qk.scenes.list(scene.projectId) }),
    })

    const enqueue = useMutation({
        mutationFn: (position: EnqueuePosition = 'back') =>
            call(contract.jobs.enqueueScenes, { body: { sceneIds: [scene.id], position } }),
        onMutate: async () => {
            const snapshots = await snapshotQueries(queryClient, {
                predicate: (query) =>
                    query.queryKey[0] === 'jobs' ||
                    matchesKey(query.queryKey, qk.scenes.list(scene.projectId)),
            })
            queryClient.setQueryData<SceneSummary[]>(qk.scenes.list(scene.projectId), (scenes) =>
                scenes?.map((item) =>
                    item.id === scene.id
                        ? { ...item, queueCount: (item.queueCount ?? 0) + 1 }
                        : item,
                ),
            )
            queryClient.setQueryData<QueueStatus>(qk.jobs.status(), (status) =>
                status ? { ...status, pendingCount: status.pendingCount + 1 } : status,
            )
            return { snapshots }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshots(queryClient, context?.snapshots)
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: qk.jobs.all() })
            void queryClient.invalidateQueries({ queryKey: qk.scenes.list(scene.projectId) })
        },
    })

    const clearQueue = useMutation({
        mutationFn: () => call(contract.jobs.clear, { query: { sceneId: scene.id } }),
        onMutate: async () => {
            const snapshots = await snapshotQueries(queryClient, {
                predicate: (query) =>
                    query.queryKey[0] === 'jobs' ||
                    matchesKey(query.queryKey, qk.scenes.list(scene.projectId)),
            })
            queryClient.setQueryData<SceneSummary[]>(qk.scenes.list(scene.projectId), (scenes) =>
                scenes?.map((item) => (item.id === scene.id ? { ...item, queueCount: 0 } : item)),
            )
            queryClient.setQueryData<QueueStatus>(qk.jobs.status(), (status) =>
                status
                    ? {
                          ...status,
                          pendingCount: Math.max(0, status.pendingCount - (scene.queueCount ?? 0)),
                      }
                    : status,
            )
            return { snapshots }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshots(queryClient, context?.snapshots)
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: qk.jobs.all() })
            void queryClient.invalidateQueries({ queryKey: qk.scenes.list(scene.projectId) })
        },
    })

    return { deleteScene, duplicateScene, enqueue, clearQueue }
}
