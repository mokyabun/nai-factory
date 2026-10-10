import type { QueryClient, QueryFilters, QueryKey } from '@tanstack/react-query'

let nextTempId = -1

/** Negative ids mark optimistic rows until the server's response replaces them. */
export function tempId() {
    nextTempId -= 1
    return nextTempId
}

export type QuerySnapshot<T = unknown> = {
    queryKey: QueryKey
    data: T | undefined
}

export async function snapshotQuery<T>(
    queryClient: QueryClient,
    queryKey: QueryKey,
): Promise<QuerySnapshot<T>> {
    await queryClient.cancelQueries({ queryKey })
    return { queryKey, data: queryClient.getQueryData<T>(queryKey) }
}

export async function snapshotQueries<T>(
    queryClient: QueryClient,
    filters: QueryFilters,
): Promise<QuerySnapshot<T>[]> {
    await queryClient.cancelQueries(filters)
    return queryClient.getQueriesData<T>(filters).map(([queryKey, data]) => ({ queryKey, data }))
}

export function restoreSnapshots(queryClient: QueryClient, snapshots?: QuerySnapshot[]) {
    for (const snapshot of snapshots ?? []) {
        queryClient.setQueryData(snapshot.queryKey, snapshot.data)
    }
}

export function restoreSnapshot(queryClient: QueryClient, snapshot?: QuerySnapshot) {
    if (!snapshot) return
    queryClient.setQueryData(snapshot.queryKey, snapshot.data)
}
