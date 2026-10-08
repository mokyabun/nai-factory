import type { Image, ImageThumb, SceneSummary } from '@nai-factory/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { RefObject } from 'react'

import { call, contract } from '@/lib/api'
import { restoreSnapshots, snapshotQueries } from '@/lib/optimistic'
import { matchesKey, qk } from '@/lib/queries'
import type { OrderPatch } from '@/lib/reorder'

export interface ReorderImageVariables extends OrderPatch {
    requestId: number
    items: Image[]
}

function toSceneImage(img: Image): ImageThumb {
    return {
        id: img.id,
        position: img.position,
        assetId: img.assetId,
        thumbAssetId: img.thumbAssetId,
        createdAt: img.createdAt,
    }
}

/** Delete and reorder mutations of a scene's image grid. */
export function useSceneImageActions({
    sceneId,
    projectId,
    latestReorderId,
    onDeleted,
    onDeleteFailed,
}: {
    sceneId: number
    projectId: number | undefined
    /** Id of the newest reorder; responses to older ones are ignored. */
    latestReorderId: RefObject<number>
    /** Clears local selection state and returns the previous selection. */
    onDeleted: (imageIds: number[]) => Set<number>
    onDeleteFailed: (previousSelectedIds: Set<number>) => void
}) {
    const queryClient = useQueryClient()

    const deleteImages = useMutation({
        mutationFn: async (imageIds: number[]) => {
            for (const id of imageIds) {
                await call(contract.images.delete, { params: { id } })
            }
        },
        onMutate: async (imageIds) => {
            const imageIdSet = new Set(imageIds)
            const snapshots = await snapshotQueries(queryClient, {
                predicate: (query) =>
                    query.queryKey[0] === 'images' ||
                    matchesKey(query.queryKey, qk.scenes.get(sceneId)) ||
                    (projectId !== undefined &&
                        matchesKey(query.queryKey, qk.scenes.list(projectId))),
            })
            queryClient.setQueryData<Image[]>(
                qk.images.list(sceneId),
                (items) => items?.filter((item) => !imageIdSet.has(item.id)) ?? items,
            )
            if (projectId !== undefined) {
                queryClient.setQueryData<SceneSummary[]>(qk.scenes.list(projectId), (scenes) =>
                    scenes?.map((scene) =>
                        scene.id === sceneId
                            ? {
                                  ...scene,
                                  imageCount: Math.max(0, scene.imageCount - imageIdSet.size),
                                  latestImages: scene.latestImages.filter(
                                      (item) => !imageIdSet.has(item.id),
                                  ),
                              }
                            : scene,
                    ),
                )
            }
            const previousSelectedIds = onDeleted(imageIds)
            return { snapshots, projectId, previousSelectedIds }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshots(queryClient, context?.snapshots)
            if (context?.previousSelectedIds) onDeleteFailed(context.previousSelectedIds)
        },
        onSettled: (_data, _error, _variables, context) => {
            void queryClient.invalidateQueries({ queryKey: qk.images.list(sceneId) })
            void queryClient.invalidateQueries({ queryKey: qk.scenes.get(sceneId) })
            if (context?.projectId !== undefined) {
                void queryClient.invalidateQueries({ queryKey: qk.scenes.list(context.projectId) })
            }
        },
    })

    const reorderImage = useMutation({
        mutationFn: ({ id, beforeId, afterId }: ReorderImageVariables) =>
            call(contract.images.move, { params: { id }, body: { beforeId, afterId } }),
        onMutate: async ({ items }) => {
            const snapshots = await snapshotQueries(queryClient, {
                predicate: (query) =>
                    query.queryKey[0] === 'images' ||
                    matchesKey(query.queryKey, qk.scenes.get(sceneId)) ||
                    (projectId !== undefined &&
                        matchesKey(query.queryKey, qk.scenes.list(projectId))),
            })
            // Placeholder positions keep the dragged order until the list is refetched.
            const orderedItems = items.map((item, index) => ({
                ...item,
                position: `~${String(index).padStart(6, '0')}`,
            }))
            queryClient.setQueryData<Image[]>(qk.images.list(sceneId), orderedItems)
            if (projectId !== undefined) {
                queryClient.setQueryData<SceneSummary[]>(qk.scenes.list(projectId), (scenes) =>
                    scenes?.map((scene) =>
                        scene.id === sceneId
                            ? {
                                  ...scene,
                                  latestImages: orderedItems.slice(0, 10).map(toSceneImage),
                              }
                            : scene,
                    ),
                )
            }
            return { snapshots, projectId }
        },
        onError: (_error, variables, context) => {
            if (variables.requestId !== latestReorderId.current) return
            restoreSnapshots(queryClient, context?.snapshots)
        },
        onSettled: (_data, _error, variables, context) => {
            if (variables.requestId === latestReorderId.current) {
                void queryClient.invalidateQueries({ queryKey: qk.images.list(sceneId) })
            }
            if (context?.projectId !== undefined) {
                void queryClient.invalidateQueries({ queryKey: qk.scenes.list(context.projectId) })
            }
        },
    })

    return { deleteImages, reorderImage }
}
