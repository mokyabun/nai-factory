import { queryOptions } from '@tanstack/react-query'

import { call, contract } from '@/lib/api'

/** Query keys, grouped like the API contract (`qk.scenes.list(projectId)` ↔ `contract.scenes.list`). */
export const qk = {
    groups: {
        all: () => ['groups'] as const,
        tree: () => ['groups', 'tree'] as const,
    },
    projects: {
        all: () => ['projects'] as const,
        get: (id: number) => ['projects', 'get', id] as const,
        vibeTransfers: (id: number) => ['projects', 'vibe-transfers', id] as const,
        characterReferences: (id: number) => ['projects', 'character-references', id] as const,
    },
    scenes: {
        all: () => ['scenes'] as const,
        list: (projectId: number) => ['scenes', 'list', projectId] as const,
        get: (id: number) => ['scenes', 'get', id] as const,
        // Under `get`, so invalidating a scene also refreshes its preview.
        preview: (id: number) => ['scenes', 'get', id, 'preview'] as const,
        summary: (id: number) => ['scenes', 'summary', id] as const,
    },
    images: {
        all: () => ['images'] as const,
        list: (sceneId: number) => ['images', 'list', sceneId] as const,
    },
    jobs: {
        all: () => ['jobs'] as const,
        status: () => ['jobs', 'status'] as const,
        lists: () => ['jobs', 'list'] as const,
        list: (projectId?: number | null) => ['jobs', 'list', projectId ?? 'all'] as const,
        history: () => ['jobs', 'history'] as const,
    },
    playground: {
        all: () => ['playground'] as const,
        state: () => ['playground', 'state'] as const,
        images: () => ['playground', 'images'] as const,
    },
    settings: {
        all: () => ['settings'] as const,
        get: () => ['settings', 'get'] as const,
        novelAIStatus: () => ['settings', 'novelai-status'] as const,
    },
    stash: {
        list: () => ['stash'] as const,
    },
    debug: {
        all: () => ['debug'] as const,
        requests: () => ['debug', 'requests'] as const,
    },
}

/** Whether `queryKey` starts with `prefix` (for predicates over several related queries). */
export function matchesKey(queryKey: readonly unknown[], prefix: readonly unknown[]) {
    return prefix.every((part, index) => queryKey[index] === part)
}

/**
 * Query definitions (key + fetcher) for `useQuery`, `prefetchQuery` and `ensureQueryData`.
 * Spread one and add options where needed: `useQuery({ ...queries.scenes.get(id), enabled })`.
 */
export const queries = {
    groups: {
        tree: () =>
            queryOptions({ queryKey: qk.groups.tree(), queryFn: () => call(contract.groups.tree) }),
    },
    projects: {
        get: (id: number) =>
            queryOptions({
                queryKey: qk.projects.get(id),
                queryFn: () => call(contract.projects.get, { params: { id } }),
            }),
        vibeTransfers: (id: number) =>
            queryOptions({
                queryKey: qk.projects.vibeTransfers(id),
                queryFn: () => call(contract.projects.vibeTransfers, { params: { id } }),
            }),
        characterReferences: (id: number) =>
            queryOptions({
                queryKey: qk.projects.characterReferences(id),
                queryFn: () => call(contract.projects.characterReferences, { params: { id } }),
            }),
    },
    scenes: {
        list: (projectId: number) =>
            queryOptions({
                queryKey: qk.scenes.list(projectId),
                queryFn: () => call(contract.scenes.list, { query: { projectId } }),
            }),
        get: (id: number) =>
            queryOptions({
                queryKey: qk.scenes.get(id),
                queryFn: () => call(contract.scenes.get, { params: { id } }),
            }),
        preview: (id: number) =>
            queryOptions({
                queryKey: qk.scenes.preview(id),
                queryFn: () => call(contract.scenes.preview, { params: { id }, query: {} }),
            }),
    },
    images: {
        list: (sceneId: number) =>
            queryOptions({
                queryKey: qk.images.list(sceneId),
                queryFn: () => call(contract.images.list, { query: { sceneId } }),
            }),
    },
    jobs: {
        status: () =>
            queryOptions({ queryKey: qk.jobs.status(), queryFn: () => call(contract.jobs.status) }),
        list: (projectId?: number | null) =>
            queryOptions({
                queryKey: qk.jobs.list(projectId),
                queryFn: () => call(contract.jobs.list, { query: projectId ? { projectId } : {} }),
            }),
        history: () =>
            queryOptions({
                queryKey: qk.jobs.history(),
                queryFn: () => call(contract.jobs.history, { query: { limit: 50 } }),
            }),
    },
    playground: {
        state: () =>
            queryOptions({
                queryKey: qk.playground.state(),
                queryFn: () => call(contract.playground.state),
            }),
        images: () =>
            queryOptions({
                queryKey: qk.playground.images(),
                queryFn: () => call(contract.playground.images, { query: { limit: 40 } }),
            }),
    },
    settings: {
        get: () =>
            queryOptions({
                queryKey: qk.settings.get(),
                queryFn: () => call(contract.settings.get),
            }),
        // No polling: generations and NovelAI settings changes refresh it through realtime events.
        novelAIStatus: () =>
            queryOptions({
                queryKey: qk.settings.novelAIStatus(),
                queryFn: () => call(contract.settings.novelAIStatus),
                staleTime: 5 * 60_000,
            }),
    },
    stash: {
        list: () =>
            queryOptions({
                queryKey: qk.stash.list(),
                queryFn: () => call(contract.stash.list, { query: {} }),
            }),
    },
    debug: {
        requests: () =>
            queryOptions({
                queryKey: qk.debug.requests(),
                queryFn: () => call(contract.debug.requests),
            }),
    },
}
