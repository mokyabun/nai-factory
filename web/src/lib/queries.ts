export const qk = {
    groupsWithProjects: () => ['groups-with-projects'] as const,
    project: (id: number) => ['project', id] as const,
    scenes: (projectId: number) => ['scenes', projectId] as const,
    images: (sceneId: number) => ['images', sceneId] as const,
    settings: () => ['settings'] as const,
    queueStatus: () => ['queue', 'status'] as const,
    vibeTransfers: (projectId: number) => ['vibe-transfers', projectId] as const,
    characterPrompts: (projectId: number) => ['character-prompts', projectId] as const,
}

/** Domain names emitted by the server SSE endpoint (queue-related only). */
export type EventDomain = 'queue' | 'images'

/** Query key prefixes to invalidate for each SSE domain event. */
export const domainQueryPrefixes: Record<EventDomain, readonly unknown[][]> = {
    // queue status changed (job started/stopped/enqueued) → update queue status + scene queueCount
    queue: [['queue'], ['scenes']],
    // job completed → new images saved → update image gallery + scene thumbnail/imageCount
    images: [['images'], ['scenes']],
}
