import type {
    CreateGroupBody,
    CreateProjectBody,
    CreateSceneBody,
    ReorderImageBody,
    ReorderSceneBody,
    ReorderVibeTransferBody,
    UpdateGroupBody,
    UpdateVibeTransferBody,
    UploadVibeTransferBody,
} from '@nai-factory/types'

export const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

type ApiError = {
    status: number
    value: unknown
}

type ApiResult<T> = Promise<{
    data: T | null
    error: ApiError | null
}>

type RequestOptions = {
    body?: unknown
    query?: Record<string, string | number | boolean | null | undefined>
}

type EntityId = { id: number }
type ProjectId = { projectId: number }

export type GroupWithProjects = {
    id: number
    name: string
    projects: Array<{ id: number; name: string }>
}

export type Project = {
    id: number
    groupId: number | null
    name: string
    prompt?: string | null
    negativePrompt?: string | null
    parameters: Record<string, unknown>
    variables?: Record<string, string> | null
    characterPrompts?: unknown[] | null
}

export type SceneSummary = {
    id: number
    projectId: number
    name: string
    displayOrder: string
    variations?: Record<string, string>[] | null
    queueCount?: number | null
    imageCount?: number | null
    latestImages?: ImageRecord[] | null
}

export type Scene = SceneSummary & {
    images?: ImageRecord[]
}

export type ImageRecord = {
    id: number
    sceneId?: number
    filePath: string
    thumbnailPath?: string | null
    displayOrder?: string
}

export type VibeTransfer = {
    id: number
    projectId: number
    displayOrder: string
    sourceImagePath: string
    referenceStrength: number
    informationExtracted: number
}

export type QueueStatus = {
    running: boolean
    processing: boolean
    pendingCount: number
    estimatedSeconds: number | null
    currentSceneId: number | null
}

function withQuery(path: string, query?: RequestOptions['query']) {
    if (!query) return path

    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
        if (value !== null && value !== undefined) params.set(key, String(value))
    }

    const search = params.toString()
    return search ? `${path}?${search}` : path
}

async function request<T>(
    path: string,
    method = 'GET',
    { body, query }: RequestOptions = {},
): ApiResult<T> {
    try {
        const isFormBody = body instanceof FormData
        const response = await fetch(`${BASE_URL}${withQuery(path, query)}`, {
            method,
            headers:
                body === undefined || isFormBody
                    ? undefined
                    : { 'Content-Type': 'application/json' },
            body: body === undefined ? undefined : isFormBody ? body : JSON.stringify(body),
        })
        const text = response.status === 204 ? '' : await response.text()
        const value = text ? (JSON.parse(text) as unknown) : null

        if (!response.ok) {
            return { data: null, error: { status: response.status, value } }
        }

        return { data: value as T, error: null }
    } catch (value) {
        return { data: null, error: { status: 0, value } }
    }
}

function postForm<T>(path: string, body: UploadVibeTransferBody) {
    const formData = new FormData()
    formData.set('image', body.image as File)
    return request<T>(path, 'POST', { body: formData })
}

function vibeTransfers(projectId: number) {
    return Object.assign(
        ({ id }: EntityId) => ({
            patch: (body: UpdateVibeTransferBody) =>
                request<VibeTransfer>(`/projects/${projectId}/vibe-transfers/${id}`, 'PATCH', {
                    body,
                }),
            delete: () => request<void>(`/projects/${projectId}/vibe-transfers/${id}`, 'DELETE'),
        }),
        {
            get: () => request<VibeTransfer[]>(`/projects/${projectId}/vibe-transfers`),
            upload: {
                post: (body: UploadVibeTransferBody) =>
                    postForm<VibeTransfer>(`/projects/${projectId}/vibe-transfers/upload`, body),
            },
            reorder: {
                patch: (body: ReorderVibeTransferBody) =>
                    request<VibeTransfer>(
                        `/projects/${projectId}/vibe-transfers/reorder`,
                        'PATCH',
                        {
                            body,
                        },
                    ),
            },
        },
    )
}

const groups = Object.assign(
    ({ id }: EntityId) => ({
        patch: (body: UpdateGroupBody) => request(`/groups/${id}`, 'PATCH', { body }),
        delete: () => request<void>(`/groups/${id}`, 'DELETE'),
    }),
    {
        get: () => request<GroupWithProjects[]>('/groups'),
        post: (body: CreateGroupBody) => request('/groups', 'POST', { body }),
    },
)

const projects = Object.assign(
    ({ projectId }: ProjectId) => ({
        get: () => request<Project>(`/projects/${projectId}`),
        patch: (body: unknown) => request<Project>(`/projects/${projectId}`, 'PATCH', { body }),
        delete: () => request<void>(`/projects/${projectId}`, 'DELETE'),
        duplicate: {
            post: () => request<Project>(`/projects/${projectId}/duplicate`, 'POST'),
        },
        'vibe-transfers': vibeTransfers(projectId),
    }),
    {
        get: ({ query }: { query: { groupId: number } }) =>
            request<Project[]>('/projects', 'GET', { query }),
        post: (body: CreateProjectBody) => request<Project>('/projects', 'POST', { body }),
    },
)

const scenes = Object.assign(
    ({ id }: EntityId) => ({
        get: () => request<Scene>(`/scenes/${id}`),
        patch: (body: unknown) => request<Scene>(`/scenes/${id}`, 'PATCH', { body }),
        delete: () => request<{ success: boolean }>(`/scenes/${id}`, 'DELETE'),
        summary: {
            get: () => request<SceneSummary>(`/scenes/${id}/summary`),
        },
        order: {
            patch: (body: ReorderSceneBody) =>
                request<Scene>(`/scenes/${id}/order`, 'PATCH', { body }),
        },
        duplicate: {
            post: () => request<Scene>(`/scenes/${id}/duplicate`, 'POST'),
        },
    }),
    {
        get: ({ query }: { query: { projectId: number } }) =>
            request<SceneSummary[]>('/scenes', 'GET', { query }),
        post: (body: CreateSceneBody) => request<Scene>('/scenes', 'POST', { body }),
    },
)

const images = Object.assign(
    ({ id }: EntityId) => ({
        delete: () => request<void>(`/images/${id}`, 'DELETE'),
        order: {
            patch: (body: ReorderImageBody) =>
                request<ImageRecord>(`/images/${id}/order`, 'PATCH', { body }),
        },
    }),
    {
        get: ({ query }: { query: { sceneId: number } }) =>
            request<ImageRecord[]>('/images', 'GET', { query }),
    },
)

export const api = {
    groups,
    projects,
    scenes,
    images,
    queue: {
        status: {
            get: () => request<QueueStatus>('/queue/status'),
        },
        enqueue: {
            post: (body: { sceneId: number; position?: 'back' | 'front' }) =>
                request('/queue/enqueue', 'POST', { body }),
        },
        'enqueue-bulk': {
            post: (body: { sceneIds: number[]; position?: 'back' | 'front' }) =>
                request('/queue/enqueue-bulk', 'POST', { body }),
        },
        start: {
            post: () => request<QueueStatus>('/queue/start', 'POST'),
        },
        stop: {
            post: () => request<QueueStatus>('/queue/stop', 'POST'),
        },
        delete: ({ query }: { query?: { sceneId?: number } } = {}) =>
            request('/queue', 'DELETE', { query }),
    },
    'sd-studio': {
        import: {
            post: (body: { projectId: number; data: unknown; options: unknown }) =>
                request('/sd-studio/import', 'POST', { body }),
        },
    },
    settings: {
        get: () => request('/settings'),
        patch: (body: unknown) => request('/settings', 'PATCH', { body }),
    },
}

export function imageUrl(path: string): string {
    return `${BASE_URL}/${path}`
}
