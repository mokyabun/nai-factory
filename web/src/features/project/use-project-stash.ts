import type {
    Project,
    SceneImportMode,
    SceneSummary,
    StashCreateBody,
    StashItem,
} from '@nai-factory/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { call, contract } from '@/lib/api'
import { restoreSnapshots, snapshotQueries, tempId } from '@/lib/optimistic'
import { optimisticSceneSummaries } from '@/lib/optimistic-scenes'
import { matchesKey, qk, queries } from '@/lib/queries'

import type { ProjectPageCallbacks } from './use-project-scene-actions'

/** Stash items and the mutations to save, delete and apply them to a project. */
export function useProjectStash(
    projectId: number,
    { takeSelection, closeDialog }: ProjectPageCallbacks,
) {
    const queryClient = useQueryClient()

    const stashQuery = useQuery(queries.stash.list())

    const save = useMutation({
        mutationFn: (body: StashCreateBody) => call(contract.stash.create, { body }),
        onMutate: async (body) => {
            const snapshots = await snapshotQueries(queryClient, { queryKey: qk.stash.list() })
            const now = new Date().toISOString()
            const id = tempId()
            const tempItem = { ...body, id, createdAt: now, updatedAt: now } as StashItem
            queryClient.setQueryData<StashItem[]>(qk.stash.list(), (current) => [
                tempItem,
                ...(current ?? []),
            ])
            return { snapshots, tempId: id }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshots(queryClient, context?.snapshots)
        },
        onSuccess: (created, _body, context) => {
            queryClient.setQueryData<StashItem[]>(qk.stash.list(), (current) =>
                current?.map((item) => (item.id === context?.tempId ? created : item)),
            )
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: qk.stash.list() }),
    })

    const remove = useMutation({
        mutationFn: (id: number) => call(contract.stash.delete, { params: { id } }),
        onMutate: async (id) => {
            const snapshots = await snapshotQueries(queryClient, { queryKey: qk.stash.list() })
            queryClient.setQueryData<StashItem[]>(qk.stash.list(), (current) =>
                current?.filter((item) => item.id !== id),
            )
            return { snapshots }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshots(queryClient, context?.snapshots)
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: qk.stash.list() }),
    })

    const apply = useMutation({
        mutationFn: ({ id, mode }: { id: number; mode?: SceneImportMode }) =>
            call(contract.stash.apply, { params: { id }, body: { projectId, mode } }),
        onMutate: async ({ id, mode }) => {
            const snapshots = await snapshotQueries(queryClient, {
                predicate: (query) =>
                    matchesKey(query.queryKey, qk.projects.get(projectId)) ||
                    matchesKey(query.queryKey, qk.scenes.list(projectId)) ||
                    matchesKey(query.queryKey, qk.jobs.all()),
            })
            const stashItem = stashQuery.data?.find((item) => item.id === id)
            if (stashItem?.type === 'prompt') {
                queryClient.setQueryData<Project>(qk.projects.get(projectId), (project) =>
                    project ? { ...project, ...stashItem.payload } : project,
                )
            } else if (stashItem?.type === 'parameters') {
                queryClient.setQueryData<Project>(qk.projects.get(projectId), (project) =>
                    project ? { ...project, parameters: stashItem.payload } : project,
                )
            } else if (stashItem?.type === 'scene') {
                const optimisticScenes = optimisticSceneSummaries(
                    projectId,
                    stashItem.payload.scenes,
                )
                const merge = (current: SceneSummary[]) =>
                    mode === 'replace' ? optimisticScenes : [...current, ...optimisticScenes]
                queryClient.setQueryData<SceneSummary[]>(qk.scenes.list(projectId), (scenes) =>
                    merge(scenes ?? []),
                )
            }
            const restoreSelection = takeSelection()
            closeDialog()
            return { snapshots, restoreSelection }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshots(queryClient, context?.snapshots)
            context?.restoreSelection()
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: qk.projects.get(projectId) })
            void queryClient.invalidateQueries({ queryKey: qk.jobs.all() })
            void queryClient.invalidateQueries({ queryKey: qk.scenes.list(projectId) })
        },
    })

    return {
        items: stashQuery.data ?? [],
        save,
        remove,
        apply,
        isPending: save.isPending || remove.isPending || apply.isPending,
    }
}
