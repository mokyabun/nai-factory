import type {
    AnyQueueItem,
    CharacterReference,
    CharacterReferenceOrderPatchBody,
    CharacterReferencePatchBody,
    CharacterReferenceUploadBody,
    GlobalSettings,
    Group,
    GroupPatchBody,
    GroupPostBody,
    Image,
    ImageGetQuery,
    ImageOrderPatchBody,
    NovelAIAccountStatus,
    PlaygroundEnqueueBody,
    PlaygroundImage,
    PlaygroundImageGetQuery,
    PlaygroundSettings,
    PlaygroundSettingsPatchBody,
    Project,
    ProjectArchiveExportBody,
    ProjectArchiveImportBody,
    ProjectExportBody,
    ProjectExportResult,
    ProjectGetQuery,
    ProjectPatchBody,
    ProjectPostBody,
    QueueClearQuery,
    QueueEnqueueAllBody,
    QueueEnqueueBody,
    QueueEnqueueBulkBody,
    Scene,
    SceneGetQuery,
    SceneJsonExportBody,
    SceneJsonFile,
    SceneJsonImportBody,
    SceneOrderPatchBody,
    ScenePatchBody,
    ScenePostBody,
    ScenePreviewGetQuery,
    ScenePreviewResult,
    SdStudioImportBody,
    SettingsPatchBody,
    StashApplyBody,
    StashApplyResult,
    StashGetQuery,
    StashItem,
    StashPatchBody,
    StashPostBody,
    Tag,
    TagAutocompleteGetQuery,
    VibeTransfer,
    VibeTransferOrderPatchBody,
    VibeTransferPatchBody,
    VibeTransferUploadBody,
} from '@nai-factory/shared'
import { http, requestBlob } from './client'
import type {
    DebugRequestEntry,
    EntityId,
    GroupWithProjects,
    ProjectGroupItem,
    ProjectId,
    QueueEnqueueResult,
    QueueStatus,
    SceneDetail,
    SceneSummary,
} from './types'
import { postUpload } from './upload'

function vibeTransfers(projectId: number) {
    return Object.assign(
        ({ id }: EntityId) => ({
            patch: (json: VibeTransferPatchBody) =>
                http.patch<VibeTransfer>(`/projects/${projectId}/vibe-transfers/${id}`, json),
            delete: () => http.delete<void>(`/projects/${projectId}/vibe-transfers/${id}`),
        }),
        {
            get: () => http.get<VibeTransfer[]>(`/projects/${projectId}/vibe-transfers`),
            upload: {
                post: (body: VibeTransferUploadBody) =>
                    postUpload<VibeTransfer>(`/projects/${projectId}/vibe-transfers/upload`, body),
            },
            reorder: {
                patch: (json: VibeTransferOrderPatchBody) =>
                    http.patch<VibeTransfer>(`/projects/${projectId}/vibe-transfers/reorder`, json),
            },
        },
    )
}

function characterReferences(projectId: number) {
    return Object.assign(
        ({ id }: EntityId) => ({
            patch: (json: CharacterReferencePatchBody) =>
                http.patch<CharacterReference>(
                    `/projects/${projectId}/character-references/${id}`,
                    json,
                ),
            delete: () => http.delete<void>(`/projects/${projectId}/character-references/${id}`),
        }),
        {
            get: () =>
                http.get<CharacterReference[]>(`/projects/${projectId}/character-references`),
            upload: {
                post: (body: CharacterReferenceUploadBody) =>
                    postUpload<CharacterReference>(
                        `/projects/${projectId}/character-references/upload`,
                        body,
                    ),
            },
            reorder: {
                patch: (json: CharacterReferenceOrderPatchBody) =>
                    http.patch<CharacterReference>(
                        `/projects/${projectId}/character-references/reorder`,
                        json,
                    ),
            },
        },
    )
}

const groups = Object.assign(
    ({ id }: EntityId) => ({
        get: () => http.get<GroupWithProjects>(`/groups/${id}`),
        patch: (json: GroupPatchBody) => http.patch<Group>(`/groups/${id}`, json),
        delete: () => http.delete<void>(`/groups/${id}`),
    }),
    {
        get: () => http.get<ProjectGroupItem[]>('/groups'),
        post: (json: GroupPostBody) => http.post<Group>('/groups', json),
    },
)

const projects = Object.assign(
    ({ projectId }: ProjectId) => ({
        get: () => http.get<Project>(`/projects/${projectId}`),
        patch: (json: ProjectPatchBody) => http.patch<Project>(`/projects/${projectId}`, json),
        delete: () => http.delete<void>(`/projects/${projectId}`),
        duplicate: {
            post: () => http.post<Project>(`/projects/${projectId}/duplicate`),
        },
        archive: {
            post: (json: ProjectArchiveExportBody) =>
                requestBlob(`/projects/${projectId}/archive`, { method: 'post', json }),
        },
        export: {
            files: {
                post: (json: ProjectExportBody) =>
                    http.post<ProjectExportResult>(`/projects/${projectId}/export/files`, json),
            },
            zip: {
                post: (json: ProjectExportBody) =>
                    requestBlob(`/projects/${projectId}/export/zip`, { method: 'post', json }),
            },
            server: {
                post: (json: ProjectExportBody) =>
                    http.post<ProjectExportResult>(`/projects/${projectId}/export/server`, json),
            },
        },
        'vibe-transfers': vibeTransfers(projectId),
        'character-references': characterReferences(projectId),
    }),
    {
        get: ({ query }: { query?: ProjectGetQuery } = {}) =>
            http.get<Project[]>('/projects', query),
        post: (json: ProjectPostBody) => http.post<Project>('/projects', json),
        import: {
            post: (body: ProjectArchiveImportBody) => postUpload<Project>('/projects/import', body),
        },
    },
)

const scenes = Object.assign(
    ({ id }: EntityId) => ({
        get: () => http.get<SceneDetail>(`/scenes/${id}`),
        patch: (json: ScenePatchBody) => http.patch<Scene>(`/scenes/${id}`, json),
        delete: () => http.delete<{ success: boolean }>(`/scenes/${id}`),
        summary: {
            get: () => http.get<SceneSummary>(`/scenes/${id}/summary`),
        },
        order: {
            patch: (json: SceneOrderPatchBody) => http.patch<Scene>(`/scenes/${id}/order`, json),
        },
        duplicate: {
            post: () => http.post<Scene>(`/scenes/${id}/duplicate`),
        },
        'preview-prompt': {
            get: ({ query }: { query?: ScenePreviewGetQuery } = {}) =>
                http.get<ScenePreviewResult>(`/scenes/${id}/preview-prompt`, query),
        },
    }),
    {
        get: ({ query }: { query: SceneGetQuery }) => http.get<SceneSummary[]>('/scenes', query),
        post: (json: ScenePostBody) => http.post<Scene>('/scenes', json),
        'export-json': {
            post: (json: SceneJsonExportBody) =>
                http.post<SceneJsonFile>('/scenes/export-json', json),
        },
        'import-json': {
            post: (json: SceneJsonImportBody) =>
                http.post<{ imported: number; scenes: Scene[] }>('/scenes/import-json', json),
        },
    },
)

const images = Object.assign(
    ({ id }: EntityId) => ({
        patch: (json: Partial<Pick<Image, 'displayOrder' | 'metadata'>>) =>
            http.patch<Image>(`/images/${id}`, json),
        delete: () => http.delete<void>(`/images/${id}`),
        order: {
            patch: (json: ImageOrderPatchBody) => http.patch<Image>(`/images/${id}/order`, json),
        },
    }),
    {
        get: ({ query }: { query: ImageGetQuery }) => http.get<Image[]>('/images', query),
    },
)

const stash = Object.assign(
    ({ id }: EntityId) => ({
        get: () => http.get<StashItem>(`/stash/${id}`),
        patch: (json: StashPatchBody) => http.patch<StashItem>(`/stash/${id}`, json),
        delete: () => http.delete<void>(`/stash/${id}`),
        apply: {
            post: (json: StashApplyBody) => http.post<StashApplyResult>(`/stash/${id}/apply`, json),
        },
    }),
    {
        get: ({ query }: { query?: StashGetQuery } = {}) => http.get<StashItem[]>('/stash', query),
        post: (json: StashPostBody) => http.post<StashItem>('/stash', json),
    },
)

export const api = {
    groups,
    projects,
    scenes,
    images,
    stash,
    queue: {
        get: ({ query }: { query?: { projectId?: number } } = {}) =>
            http.get<AnyQueueItem[]>('/queue', query),
        status: {
            get: () => http.get<QueueStatus>('/queue/status'),
        },
        enqueue: {
            post: (json: QueueEnqueueBody) => http.post<QueueEnqueueResult>('/queue/enqueue', json),
        },
        'enqueue-all': {
            post: (json: QueueEnqueueAllBody) =>
                http.post<QueueEnqueueResult>('/queue/enqueue-all', json),
        },
        'enqueue-bulk': {
            post: (json: QueueEnqueueBulkBody) =>
                http.post<QueueEnqueueResult>('/queue/enqueue-bulk', json),
        },
        start: {
            post: () => http.post<QueueStatus>('/queue/start'),
        },
        stop: {
            post: () => http.post<QueueStatus>('/queue/stop'),
        },
        delete: ({ query }: { query?: QueueClearQuery } = {}) =>
            http.delete<{ cancelled: number }>('/queue', query),
    },
    playground: {
        settings: {
            get: () => http.get<PlaygroundSettings>('/playground/settings'),
            patch: (json: PlaygroundSettingsPatchBody) =>
                http.patch<PlaygroundSettings>('/playground/settings', json),
        },
        images: {
            get: ({ query }: { query?: PlaygroundImageGetQuery } = {}) =>
                http.get<PlaygroundImage[]>('/playground/images', query),
            delete: ({ id }: EntityId) => http.delete<void>(`/playground/images/${id}`),
        },
        enqueue: {
            post: (json: PlaygroundEnqueueBody) =>
                http.post<{ queued: number; item: unknown }>('/playground/enqueue', json),
        },
    },
    debug: {
        requests: {
            get: () => http.get<DebugRequestEntry[]>('/debug/requests'),
            delete: () => http.delete<void>('/debug/requests'),
        },
    },
    'sd-studio': {
        import: {
            post: (json: SdStudioImportBody) =>
                http.post<{ imported: number; scenes: Scene[] }>('/sd-studio/import', json),
        },
    },
    settings: {
        get: () => http.get<GlobalSettings>('/settings'),
        novelai: {
            status: {
                get: () => http.get<NovelAIAccountStatus>('/settings/novelai/status'),
            },
        },
        patch: (json: SettingsPatchBody) => http.patch<GlobalSettings>('/settings', json),
    },
    tags: {
        autocomplete: {
            get: ({ query }: { query: TagAutocompleteGetQuery }) =>
                http.get<Tag[]>('/tags/autocomplete', query),
        },
    },
}
