import * as z from 'zod'

import { IdParams } from '../inputs/common'
import { GcQuery, SdStudioImportBody, TagAutocompleteQuery } from '../inputs/misc'
import { PlaygroundImageListQuery, PlaygroundStatePatch } from '../inputs/playground'
import { LoginBody, NovelAIKeyBody, SettingsPatch } from '../inputs/settings'
import {
    StashApplyBody,
    StashCaptureScenesBody,
    StashCreateBody,
    StashListQuery,
    StashPatch,
} from '../inputs/stash'
import { OkResponse } from '../schemas/common'
import { DebugRequest, GcReport } from '../schemas/debug'
import { PlaygroundImage, PlaygroundState } from '../schemas/playground'
import { SceneImportResult } from '../schemas/scene'
import { NovelAIAccountStatus, SettingsView } from '../schemas/settings'
import { StashApplyResult, StashItem, StashScenePayload } from '../schemas/stash'
import { Tag } from '../schemas/tag'
import { endpoint } from './define'

export const playground = {
    state: endpoint({ method: 'GET', path: '/playground/state', response: PlaygroundState }),
    updateState: endpoint({
        method: 'PATCH',
        path: '/playground/state',
        body: PlaygroundStatePatch,
        response: PlaygroundState,
    }),
    images: endpoint({
        method: 'GET',
        path: '/playground/images',
        query: PlaygroundImageListQuery,
        response: z.array(PlaygroundImage),
    }),
    deleteImage: endpoint({
        method: 'DELETE',
        path: '/playground/images/:id',
        params: IdParams,
        response: null,
    }),
}

export const settings = {
    get: endpoint({ method: 'GET', path: '/settings', response: SettingsView }),
    update: endpoint({
        method: 'PATCH',
        path: '/settings',
        body: SettingsPatch,
        response: SettingsView,
    }),
    reset: endpoint({ method: 'DELETE', path: '/settings', response: SettingsView }),
    setNovelAIKey: endpoint({
        method: 'PUT',
        path: '/settings/novelai-key',
        body: NovelAIKeyBody,
        response: SettingsView,
    }),
    deleteNovelAIKey: endpoint({
        method: 'DELETE',
        path: '/settings/novelai-key',
        response: SettingsView,
    }),
    novelAIStatus: endpoint({
        method: 'GET',
        path: '/settings/novelai/status',
        response: NovelAIAccountStatus,
    }),
}

export const stash = {
    list: endpoint({
        method: 'GET',
        path: '/stash',
        query: StashListQuery,
        response: z.array(StashItem),
    }),
    get: endpoint({ method: 'GET', path: '/stash/:id', params: IdParams, response: StashItem }),
    create: endpoint({
        method: 'POST',
        path: '/stash',
        body: StashCreateBody,
        response: StashItem,
        status: 201,
    }),
    update: endpoint({
        method: 'PATCH',
        path: '/stash/:id',
        params: IdParams,
        body: StashPatch,
        response: StashItem,
    }),
    delete: endpoint({ method: 'DELETE', path: '/stash/:id', params: IdParams, response: null }),
    apply: endpoint({
        method: 'POST',
        path: '/stash/:id/apply',
        params: IdParams,
        body: StashApplyBody,
        response: StashApplyResult,
    }),
    captureScenes: endpoint({
        method: 'POST',
        path: '/stash/capture-scenes',
        body: StashCaptureScenesBody,
        response: StashScenePayload,
    }),
}

export const sdStudio = {
    import: endpoint({
        method: 'POST',
        path: '/sd-studio/import',
        body: SdStudioImportBody,
        response: SceneImportResult,
        status: 201,
    }),
}

export const tags = {
    autocomplete: endpoint({
        method: 'GET',
        path: '/tags/autocomplete',
        query: TagAutocompleteQuery,
        response: z.array(Tag),
    }),
}

export const debug = {
    requests: endpoint({
        method: 'GET',
        path: '/debug/requests',
        response: z.array(DebugRequest),
    }),
    clearRequests: endpoint({ method: 'DELETE', path: '/debug/requests', response: null }),
    gc: endpoint({ method: 'GET', path: '/debug/gc', query: GcQuery, response: GcReport }),
}

export const system = {
    health: endpoint({
        method: 'GET',
        path: '/healthz',
        response: z.object({ ok: z.literal(true), version: z.string() }),
    }),
    login: endpoint({ method: 'POST', path: '/auth/login', body: LoginBody, response: OkResponse }),
    logout: endpoint({ method: 'POST', path: '/auth/logout', response: OkResponse }),
}
