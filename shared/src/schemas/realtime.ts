import type { SettingsSection } from './settings'

/** Server-sent events. Each event carries a monotonically increasing SSE id. */
export type RealtimeEvent =
    | {
          type: 'job.progress'
          jobId: number
          done: number
          total: number | null
          imageStartedAt: string | null
      }
    | { type: 'jobs.changed' }
    | { type: 'scene.images.changed'; projectId: number; sceneId: number }
    | { type: 'playground.images.changed' }
    | { type: 'settings.changed'; sections: SettingsSection[] }
    | { type: 'debug.requests.changed' }
    /** Sent when missed events can no longer be replayed; clients refetch everything. */
    | { type: 'resync' }

export type RealtimeEventType = RealtimeEvent['type']
