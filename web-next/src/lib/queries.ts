export const qk = {
    groupsWithProjects: () => ['groups-with-projects'] as const,
    project: (id: number) => ['project', id] as const,
    scene: (id: number) => ['scene', id] as const,
    sceneContext: (id: number) => ['scene-ctx', id] as const,
    scenes: (projectId: number) => ['scenes', projectId] as const,
    images: (sceneId: number) => ['images', sceneId] as const,
    settings: () => ['settings'] as const,
    queueStatus: () => ['queue', 'status'] as const,
    vibeTransfers: (projectId: number) => ['vibe-transfers', projectId] as const,
    characterReferences: (projectId: number) => ['character-references', projectId] as const,
}
