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
        summary: (id: number) => ['scenes', 'summary', id] as const,
    },
    images: {
        all: () => ['images'] as const,
        list: (sceneId: number) => ['images', 'list', sceneId] as const,
    },
    jobs: {
        all: () => ['jobs'] as const,
        status: () => ['jobs', 'status'] as const,
        list: (projectId?: number | null) => ['jobs', 'list', projectId ?? 'all'] as const,
        history: () => ['jobs', 'history'] as const,
    },
    playground: {
        state: () => ['playground', 'state'] as const,
        images: () => ['playground', 'images'] as const,
    },
    settings: {
        get: () => ['settings', 'get'] as const,
        novelAIStatus: () => ['settings', 'novelai-status'] as const,
    },
    stash: {
        list: () => ['stash'] as const,
    },
    debug: {
        requests: () => ['debug', 'requests'] as const,
    },
}

/** Whether `queryKey` starts with `prefix` (for predicates over several related queries). */
export function matchesKey(queryKey: readonly unknown[], prefix: readonly unknown[]) {
    return prefix.every((part, index) => queryKey[index] === part)
}
