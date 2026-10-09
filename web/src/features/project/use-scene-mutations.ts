import type { EnqueuePosition, QueueStatus, Scene, SceneSummary } from '@nai-factory/shared'
import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query'

import { call, contract } from '@/lib/api'
import { restoreSnapshots, snapshotQueries, tempId } from '@/lib/optimistic'
import { matchesKey, qk } from '@/lib/queries'
import type { OrderPatch } from '@/lib/reorder'

function toSummary(scene: Scene): SceneSummary {
    return { ...scene, imageCount: 0, queueCount: 0, latestImages: [] }
}

/** Snapshots a project's scene list and every job query, the caches queue changes touch. */
function snapshotSceneQueue(queryClient: QueryClient, projectId: number) {
    return snapshotQueries(queryClient, {
        predicate: (query) =>
            matchesKey(query.queryKey, qk.jobs.all()) ||
            matchesKey(query.queryKey, qk.scenes.list(projectId)),
    })
}

function invalidateSceneQueue(queryClient: QueryClient, projectId: number) {
    void queryClient.invalidateQueries({ queryKey: qk.jobs.all() })
    void queryClient.invalidateQueries({ queryKey: qk.scenes.list(projectId) })
}

function addPendingCount(queryClient: QueryClient, delta: number) {
    queryClient.setQueryData<QueueStatus>(qk.jobs.status(), (status) =>
        status ? { ...status, pendingCount: Math.max(0, status.pendingCount + delta) } : status,
    )
}

/** Shared by the grid and the scene cards so both show the same optimistic updates. */
export function useSceneMutations(projectId: number) {
    const queryClient = useQueryClient()
    const scenesKey = qk.scenes.list(projectId)

    const create = useMutation({
        mutationFn: (name: string) => call(contract.scenes.create, { body: { projectId, name } }),
        onMutate: async (name) => {
            const snapshots = await snapshotQueries(queryClient, { queryKey: scenesKey })
            const now = new Date().toISOString()
            const tempScene: SceneSummary = {
                id: tempId(),
                projectId,
                // `~` sorts after the server's fractional keys, so the placeholder stays last.
                position: '~',
                name,
                variations: [],
                createdAt: now,
                updatedAt: now,
                imageCount: 0,
                queueCount: 0,
                latestImages: [],
            }
            queryClient.setQueryData<SceneSummary[]>(scenesKey, (scenes) => [
                ...(scenes ?? []),
                tempScene,
            ])
            return { snapshots, tempId: tempScene.id }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshots(queryClient, context?.snapshots)
        },
        onSuccess: (created, _name, context) => {
            queryClient.setQueryData<SceneSummary[]>(scenesKey, (scenes) =>
                scenes?.map((scene) => (scene.id === context?.tempId ? toSummary(created) : scene)),
            )
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: scenesKey }),
    })

    const duplicate = useMutation({
        mutationFn: (scene: SceneSummary) =>
            call(contract.scenes.duplicate, { params: { id: scene.id } }),
        onMutate: async (scene) => {
            const snapshots = await snapshotQueries(queryClient, { queryKey: scenesKey })
            const tempScene: SceneSummary = {
                ...scene,
                id: tempId(),
                name: `${scene.name} Copy`,
                imageCount: 0,
                latestImages: [],
                queueCount: 0,
            }
            queryClient.setQueryData<SceneSummary[]>(scenesKey, (scenes) => {
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
        onSuccess: (created, _scene, context) => {
            queryClient.setQueryData<SceneSummary[]>(scenesKey, (scenes) =>
                scenes?.map((item) => (item.id === context?.tempId ? toSummary(created) : item)),
            )
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: scenesKey }),
    })

    /** Moves a scene; `items` is the list in its new order, shown until the server confirms. */
    const move = useMutation({
        mutationFn: ({ id, beforeId, afterId }: OrderPatch & { items: SceneSummary[] }) =>
            call(contract.scenes.move, { params: { id }, body: { beforeId, afterId } }),
        onMutate: async ({ items }) => {
            const snapshots = await snapshotQueries(queryClient, { queryKey: scenesKey })
            queryClient.setQueryData(scenesKey, items)
            return { snapshots }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshots(queryClient, context?.snapshots)
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: scenesKey }),
    })

    const enqueue = useMutation({
        mutationFn: ({ sceneIds, position }: { sceneIds: number[]; position: EnqueuePosition }) =>
            call(contract.jobs.enqueueScenes, { body: { sceneIds, position } }),
        onMutate: async ({ sceneIds }) => {
            const snapshots = await snapshotSceneQueue(queryClient, projectId)
            const sceneIdSet = new Set(sceneIds)
            // The server queues one job per variation.
            const jobCount = (queryClient.getQueryData<SceneSummary[]>(scenesKey) ?? [])
                .filter((scene) => sceneIdSet.has(scene.id))
                .reduce((total, scene) => total + scene.variations.length, 0)
            queryClient.setQueryData<SceneSummary[]>(scenesKey, (scenes) =>
                scenes?.map((scene) =>
                    sceneIdSet.has(scene.id)
                        ? { ...scene, queueCount: scene.queueCount + scene.variations.length }
                        : scene,
                ),
            )
            addPendingCount(queryClient, jobCount)
            return { snapshots }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshots(queryClient, context?.snapshots)
        },
        onSettled: () => invalidateSceneQueue(queryClient, projectId),
    })

    const clearQueue = useMutation({
        mutationFn: (scene: SceneSummary) =>
            call(contract.jobs.clear, { query: { sceneId: scene.id } }),
        onMutate: async (scene) => {
            const snapshots = await snapshotSceneQueue(queryClient, projectId)
            queryClient.setQueryData<SceneSummary[]>(scenesKey, (scenes) =>
                scenes?.map((item) => (item.id === scene.id ? { ...item, queueCount: 0 } : item)),
            )
            addPendingCount(queryClient, -scene.queueCount)
            return { snapshots }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshots(queryClient, context?.snapshots)
        },
        onSettled: () => invalidateSceneQueue(queryClient, projectId),
    })

    const remove = useMutation({
        mutationFn: async (sceneIds: number[]) => {
            for (const id of sceneIds) await call(contract.scenes.delete, { params: { id } })
        },
        onMutate: async (sceneIds) => {
            const snapshots = await snapshotSceneQueue(queryClient, projectId)
            const sceneIdSet = new Set(sceneIds)
            queryClient.setQueryData<SceneSummary[]>(scenesKey, (scenes) =>
                scenes?.filter((scene) => !sceneIdSet.has(scene.id)),
            )
            return { snapshots }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshots(queryClient, context?.snapshots)
        },
        onSettled: () => invalidateSceneQueue(queryClient, projectId),
    })

    return { create, duplicate, move, enqueue, clearQueue, remove }
}
