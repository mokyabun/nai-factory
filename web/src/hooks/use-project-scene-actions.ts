import type { EnqueuePosition, QueueStatus, SceneSummary } from '@nai-factory/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAtom, useSetAtom } from 'jotai'

import { call, contract } from '@/lib/api'
import { restoreSnapshots, snapshotQueries } from '@/lib/optimistic'
import { tempId } from '@/lib/optimistic-scenes'
import { matchesKey, qk } from '@/lib/queries'
import type { OrderPatch } from '@/lib/reorder'
import {
    projectPageDialogAtom,
    sceneItemsAtom,
    selectedSceneIdsSetAtom,
} from '@/routes/project/$projectId/atom'

/** Scene mutations of the project page, each with an optimistic update. */
export function useProjectSceneActions(
    projectId: number,
    serverScenes: SceneSummary[] | undefined,
) {
    const queryClient = useQueryClient()
    const [items, setItems] = useAtom(sceneItemsAtom)
    const [selectedIds, setSelectedIds] = useAtom(selectedSceneIdsSetAtom)
    const setProjectDialog = useSetAtom(projectPageDialogAtom)
    const scenesKey = qk.scenes.list(projectId)
    const affectsQueue = (queryKey: readonly unknown[]) =>
        queryKey[0] === 'jobs' || matchesKey(queryKey, scenesKey)

    function invalidate() {
        void queryClient.invalidateQueries({ queryKey: qk.jobs.all() })
        void queryClient.invalidateQueries({ queryKey: scenesKey })
    }

    const createScene = useMutation({
        mutationFn: (name: string) => call(contract.scenes.create, { body: { projectId, name } }),
        onMutate: async (name) => {
            const snapshots = await snapshotQueries(queryClient, { queryKey: scenesKey })
            const now = new Date().toISOString()
            const tempScene: SceneSummary = {
                id: tempId(),
                projectId,
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
            setItems((current) => [...current, tempScene])
            return { snapshots, tempId: tempScene.id }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshots(queryClient, context?.snapshots)
            if (context?.snapshots[0]?.data) setItems(context.snapshots[0].data as SceneSummary[])
        },
        onSuccess: (created, _name, context) => {
            const summary: SceneSummary = {
                ...created,
                imageCount: 0,
                queueCount: 0,
                latestImages: [],
            }
            const replace = (scenes: SceneSummary[]) =>
                scenes.map((scene) => (scene.id === context?.tempId ? summary : scene))
            queryClient.setQueryData<SceneSummary[]>(
                scenesKey,
                (scenes) => scenes && replace(scenes),
            )
            setItems(replace)
            setProjectDialog(null)
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: scenesKey }),
    })

    const moveScene = useMutation({
        mutationFn: ({ id, beforeId, afterId }: OrderPatch) =>
            call(contract.scenes.move, { params: { id }, body: { beforeId, afterId } }),
        onMutate: async () => {
            const snapshots = await snapshotQueries<SceneSummary[]>(queryClient, {
                queryKey: scenesKey,
            })
            queryClient.setQueryData(scenesKey, items)
            return { snapshots, previousItems: serverScenes ?? [] }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshots(queryClient, context?.snapshots)
            if (context?.previousItems) setItems(context.previousItems)
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: scenesKey }),
    })

    const enqueueScenes = useMutation({
        mutationFn: ({ sceneIds, position }: { sceneIds: number[]; position: EnqueuePosition }) =>
            call(contract.jobs.enqueueScenes, { body: { sceneIds, position } }),
        onMutate: async ({ sceneIds }) => {
            const snapshots = await snapshotQueries(queryClient, {
                predicate: (query) => affectsQueue(query.queryKey),
            })
            const sceneIdSet = new Set(sceneIds)
            queryClient.setQueryData<SceneSummary[]>(scenesKey, (scenes) =>
                scenes?.map((scene) =>
                    sceneIdSet.has(scene.id)
                        ? { ...scene, queueCount: scene.queueCount + scene.variations.length }
                        : scene,
                ),
            )
            queryClient.setQueryData<QueueStatus>(qk.jobs.status(), (status) =>
                status
                    ? { ...status, pendingCount: status.pendingCount + sceneIds.length }
                    : status,
            )
            const previousSelectedIds = selectedIds
            setSelectedIds(new Set<number>())
            return { snapshots, previousSelectedIds }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshots(queryClient, context?.snapshots)
            if (context?.previousSelectedIds) setSelectedIds(context.previousSelectedIds)
        },
        onSettled: invalidate,
    })

    const deleteScenes = useMutation({
        mutationFn: async (sceneIds: number[]) => {
            for (const id of sceneIds) await call(contract.scenes.delete, { params: { id } })
        },
        onMutate: async (sceneIds) => {
            const snapshots = await snapshotQueries(queryClient, {
                predicate: (query) => affectsQueue(query.queryKey),
            })
            const sceneIdSet = new Set(sceneIds)
            queryClient.setQueryData<SceneSummary[]>(scenesKey, (scenes) =>
                scenes?.filter((scene) => !sceneIdSet.has(scene.id)),
            )
            setItems((current) => current.filter((scene) => !sceneIdSet.has(scene.id)))
            const previousSelectedIds = selectedIds
            setSelectedIds(new Set<number>())
            setProjectDialog(null)
            return { snapshots, previousItems: items, previousSelectedIds }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshots(queryClient, context?.snapshots)
            if (context?.previousItems) setItems(context.previousItems)
            if (context?.previousSelectedIds) setSelectedIds(context.previousSelectedIds)
        },
        onSettled: invalidate,
    })

    return { createScene, moveScene, enqueueScenes, deleteScenes }
}
