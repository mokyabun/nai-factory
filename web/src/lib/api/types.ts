import type { GroupListItem, Image, Project, QueueItem, Scene } from '@nai-factory/shared'
import type { Options } from 'ky'

export type ApiError = {
    status: number
    value: unknown
}

export type ApiResult<T> = Promise<{
    data: T | null
    error: ApiError | null
}>

export type SearchParams = Record<string, string | number | boolean | null | undefined>

export type ApiRequestOptions = Omit<Options, 'json' | 'body' | 'searchParams'> & {
    json?: unknown
    body?: BodyInit
    searchParams?: SearchParams
}

export type EntityId = { id: number }
export type ProjectId = { projectId: number }

export type GroupWithProjects = Extract<GroupListItem, { type: 'group' }>
export type ProjectGroupItem = GroupListItem
export type ProjectGroupId = Project['groupId']

export type SceneImage = Pick<Image, 'id' | 'filePath' | 'thumbnailPath'>

export type SceneSummary = Scene & {
    imageCount: number
    queueCount: number
    latestImages: SceneImage[]
}

export type SceneDetail = Scene & {
    images: Image[]
}

export type QueueStatus = {
    running: boolean
    processing: boolean
    pendingCount: number
    estimatedSeconds: number | null
    currentSceneId: number | null
    currentJob: QueueStatusJob | null
    avgDurationMs: number | null
    durationSampleSize: number
    completedCount: number
    failedCount: number
    recent: QueueHistoryEntry[]
}

export type QueueEnqueueResult = {
    queued: number
    items: QueueItem[]
}

export type QueueStatusJob = {
    id: number
    type: 'scene' | 'playground'
    projectId: number | null
    sceneId: number | null
    sceneVariationId: number | null
    sceneName: string
    prompt: string | null
    startedAt: string
    elapsedSeconds: number
}

export type QueueHistoryEntry = {
    id: number
    jobId: number
    type: 'scene' | 'playground'
    projectId: number | null
    sceneId: number | null
    sceneVariationId: number | null
    sceneName: string
    prompt: string | null
    status: 'completed' | 'failed'
    startedAt: string
    durationMs: number
    completedAt: string
    error: string | null
    failureCategory: string | null
}

export type DebugRequestEntry = {
    id: number
    createdAt: string
    completedAt: string | null
    durationMs: number | null
    status: 'pending' | 'success' | 'error'
    method: string
    url: string
    context: Record<string, unknown>
    request: unknown
    response: unknown
    error: string | null
}
