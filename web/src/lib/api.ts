import type {
    CharacterReference,
    CharacterReferenceOrderPatchBody,
    CharacterReferencePatchBody,
    CharacterReferenceUploadBody,
    GlobalSettings,
    Group,
    GroupListItem,
    GroupPatchBody,
    GroupPostBody,
    Image,
    ImageGetQuery,
    ImageOrderPatchBody,
    Project,
    ProjectGetQuery,
    ProjectPatchBody,
    ProjectPostBody,
    QueueClearQuery,
    QueueEnqueueAllBody,
    QueueEnqueueBody,
    QueueEnqueueBulkBody,
    QueueItem,
    Scene,
    SceneGetQuery,
    SceneOrderPatchBody,
    ScenePatchBody,
    ScenePostBody,
    SdStudioImportBody,
    SettingsPatchBody,
    Tag,
    TagAutocompleteGetQuery,
    VibeTransfer,
    VibeTransferOrderPatchBody,
    VibeTransferPatchBody,
    VibeTransferUploadBody,
} from '@nai-factory/types'
import ky, { HTTPError, type Options } from 'ky'

export const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export const apiClient = ky.create({
    prefix: BASE_URL,
})

export type ApiError = {
    status: number
    value: unknown
}

export type ApiResult<T> = Promise<{
    data: T | null
    error: ApiError | null
}>

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
}

type SearchParams = Record<string, string | number | boolean | null | undefined>

type ApiRequestOptions = Omit<Options, 'json' | 'body' | 'searchParams'> & {
    json?: unknown
    body?: BodyInit
    searchParams?: SearchParams
}

function apiPath(path: string) {
    return path.replace(/^\/+/, '')
}

function searchParams(query?: SearchParams) {
    if (!query) return undefined

    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
        if (value !== null && value !== undefined) params.set(key, String(value))
    }

    return params
}

function parseText(text: string) {
    if (!text) return null

    try {
        return JSON.parse(text) as unknown
    } catch {
        return text
    }
}

async function readError(error: HTTPError): Promise<ApiError> {
    const text = await error.response.text()
    return {
        status: error.response.status,
        value: parseText(text),
    }
}

async function request<T>(path: string, options: ApiRequestOptions = {}): ApiResult<T> {
    try {
        const response = await apiClient(apiPath(path), {
            ...options,
            searchParams: searchParams(options.searchParams),
        })

        if (response.status === 204) return { data: null, error: null }

        const value = parseText(await response.text())
        return { data: value as T, error: null }
    } catch (error) {
        if (error instanceof HTTPError) return { data: null, error: await readError(error) }

        return { data: null, error: { status: 0, value: error } }
    }
}

type ImageUploadBody = VibeTransferUploadBody | CharacterReferenceUploadBody

async function formDataFromUpload(body: ImageUploadBody) {
    const formData = new FormData()

    if (body.image instanceof Blob) {
        formData.set('image', body.image, body.image.name)
        return formData
    }

    const blob = new Blob([await body.image.arrayBuffer()], { type: body.image.type })
    formData.set('image', blob, body.image.name)
    return formData
}

async function postUpload<T>(path: string, body: ImageUploadBody) {
    return request<T>(path, {
        method: 'post',
        body: await formDataFromUpload(body),
    })
}

function vibeTransfers(projectId: number) {
    return Object.assign(
        ({ id }: EntityId) => ({
            patch: (json: VibeTransferPatchBody) =>
                request<VibeTransfer>(`/projects/${projectId}/vibe-transfers/${id}`, {
                    method: 'patch',
                    json,
                }),
            delete: () =>
                request<void>(`/projects/${projectId}/vibe-transfers/${id}`, {
                    method: 'delete',
                }),
        }),
        {
            get: () => request<VibeTransfer[]>(`/projects/${projectId}/vibe-transfers`),
            upload: {
                post: (body: VibeTransferUploadBody) =>
                    postUpload<VibeTransfer>(`/projects/${projectId}/vibe-transfers/upload`, body),
            },
            reorder: {
                patch: (json: VibeTransferOrderPatchBody) =>
                    request<VibeTransfer>(`/projects/${projectId}/vibe-transfers/reorder`, {
                        method: 'patch',
                        json,
                    }),
            },
        },
    )
}

function characterReferences(projectId: number) {
    return Object.assign(
        ({ id }: EntityId) => ({
            patch: (json: CharacterReferencePatchBody) =>
                request<CharacterReference>(`/projects/${projectId}/character-references/${id}`, {
                    method: 'patch',
                    json,
                }),
            delete: () =>
                request<void>(`/projects/${projectId}/character-references/${id}`, {
                    method: 'delete',
                }),
        }),
        {
            get: () => request<CharacterReference[]>(`/projects/${projectId}/character-references`),
            upload: {
                post: (body: CharacterReferenceUploadBody) =>
                    postUpload<CharacterReference>(
                        `/projects/${projectId}/character-references/upload`,
                        body,
                    ),
            },
            reorder: {
                patch: (json: CharacterReferenceOrderPatchBody) =>
                    request<CharacterReference>(
                        `/projects/${projectId}/character-references/reorder`,
                        {
                            method: 'patch',
                            json,
                        },
                    ),
            },
        },
    )
}

const groups = Object.assign(
    ({ id }: EntityId) => ({
        get: () => request<GroupWithProjects>(`/groups/${id}`),
        patch: (json: GroupPatchBody) => request<Group>(`/groups/${id}`, { method: 'patch', json }),
        delete: () => request<void>(`/groups/${id}`, { method: 'delete' }),
    }),
    {
        get: () => request<ProjectGroupItem[]>('/groups'),
        post: (json: GroupPostBody) => request<Group>('/groups', { method: 'post', json }),
    },
)

const projects = Object.assign(
    ({ projectId }: ProjectId) => ({
        get: () => request<Project>(`/projects/${projectId}`),
        patch: (json: ProjectPatchBody) =>
            request<Project>(`/projects/${projectId}`, { method: 'patch', json }),
        delete: () => request<void>(`/projects/${projectId}`, { method: 'delete' }),
        duplicate: {
            post: () => request<Project>(`/projects/${projectId}/duplicate`, { method: 'post' }),
        },
        'vibe-transfers': vibeTransfers(projectId),
        'character-references': characterReferences(projectId),
    }),
    {
        get: ({ query }: { query?: ProjectGetQuery } = {}) =>
            request<Project[]>('/projects', { searchParams: query }),
        post: (json: ProjectPostBody) => request<Project>('/projects', { method: 'post', json }),
    },
)

const scenes = Object.assign(
    ({ id }: EntityId) => ({
        get: () => request<SceneDetail>(`/scenes/${id}`),
        patch: (json: ScenePatchBody) => request<Scene>(`/scenes/${id}`, { method: 'patch', json }),
        delete: () => request<{ success: boolean }>(`/scenes/${id}`, { method: 'delete' }),
        summary: {
            get: () => request<SceneSummary>(`/scenes/${id}/summary`),
        },
        order: {
            patch: (json: SceneOrderPatchBody) =>
                request<Scene>(`/scenes/${id}/order`, { method: 'patch', json }),
        },
        duplicate: {
            post: () => request<Scene>(`/scenes/${id}/duplicate`, { method: 'post' }),
        },
    }),
    {
        get: ({ query }: { query: SceneGetQuery }) =>
            request<SceneSummary[]>('/scenes', { searchParams: query }),
        post: (json: ScenePostBody) => request<Scene>('/scenes', { method: 'post', json }),
    },
)

const images = Object.assign(
    ({ id }: EntityId) => ({
        patch: (json: Partial<Pick<Image, 'displayOrder' | 'metadata'>>) =>
            request<Image>(`/images/${id}`, { method: 'patch', json }),
        delete: () => request<void>(`/images/${id}`, { method: 'delete' }),
        order: {
            patch: (json: ImageOrderPatchBody) =>
                request<Image>(`/images/${id}/order`, { method: 'patch', json }),
        },
    }),
    {
        get: ({ query }: { query: ImageGetQuery }) =>
            request<Image[]>('/images', { searchParams: query }),
    },
)

export const api = {
    groups,
    projects,
    scenes,
    images,
    queue: {
        get: ({ query }: { query?: { projectId?: number } } = {}) =>
            request<QueueItem[]>('/queue', { searchParams: query }),
        status: {
            get: () => request<QueueStatus>('/queue/status'),
        },
        enqueue: {
            post: (json: QueueEnqueueBody) =>
                request<QueueItem>('/queue/enqueue', { method: 'post', json }),
        },
        'enqueue-all': {
            post: (json: QueueEnqueueAllBody) =>
                request<{ queued: number; items: QueueItem[] }>('/queue/enqueue-all', {
                    method: 'post',
                    json,
                }),
        },
        'enqueue-bulk': {
            post: (json: QueueEnqueueBulkBody) =>
                request<{ queued: number; items: QueueItem[] }>('/queue/enqueue-bulk', {
                    method: 'post',
                    json,
                }),
        },
        start: {
            post: () => request<QueueStatus>('/queue/start', { method: 'post' }),
        },
        stop: {
            post: () => request<QueueStatus>('/queue/stop', { method: 'post' }),
        },
        delete: ({ query }: { query?: QueueClearQuery } = {}) =>
            request<{ cancelled: number }>('/queue', { method: 'delete', searchParams: query }),
    },
    'sd-studio': {
        import: {
            post: (json: SdStudioImportBody) =>
                request<{ imported: number; scenes: Scene[] }>('/sd-studio/import', {
                    method: 'post',
                    json,
                }),
        },
    },
    settings: {
        get: () => request<GlobalSettings>('/settings'),
        patch: (json: SettingsPatchBody) =>
            request<GlobalSettings>('/settings', { method: 'patch', json }),
    },
    tags: {
        autocomplete: {
            get: ({ query }: { query: TagAutocompleteGetQuery }) =>
                request<Tag[]>('/tags/autocomplete', { searchParams: query }),
        },
    },
}

export function imageUrl(path: string): string {
    return `${BASE_URL}/${path}`
}
