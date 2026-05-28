export type RealtimeEvent =
    | { type: 'queue.changed' }
    | { type: 'scene.images.changed'; projectId: number; sceneId: number }
    | { type: 'playground.images.changed' }
    | { type: 'debug.requests.changed' }
