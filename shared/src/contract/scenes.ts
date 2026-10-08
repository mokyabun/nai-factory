import * as z from 'zod'

import { IdParams, MoveBody } from '../inputs/common'
import { ImageListQuery } from '../inputs/images'
import {
    SceneCreateBody,
    SceneJsonExportBody,
    SceneJsonImportBody,
    SceneListQuery,
    ScenePatch,
    ScenePreviewQuery,
} from '../inputs/scenes'
import { Image } from '../schemas/image'
import {
    Scene,
    SceneImportResult,
    SceneJsonFile,
    ScenePreviewResult,
    SceneSummary,
} from '../schemas/scene'
import { endpoint } from './define'

export const scenes = {
    list: endpoint({
        method: 'GET',
        path: '/scenes',
        query: SceneListQuery,
        response: z.array(SceneSummary),
    }),
    get: endpoint({ method: 'GET', path: '/scenes/:id', params: IdParams, response: Scene }),
    summary: endpoint({
        method: 'GET',
        path: '/scenes/:id/summary',
        params: IdParams,
        response: SceneSummary,
    }),
    preview: endpoint({
        method: 'GET',
        path: '/scenes/:id/preview',
        params: IdParams,
        query: ScenePreviewQuery,
        response: ScenePreviewResult,
    }),
    create: endpoint({
        method: 'POST',
        path: '/scenes',
        body: SceneCreateBody,
        response: Scene,
        status: 201,
    }),
    update: endpoint({
        method: 'PATCH',
        path: '/scenes/:id',
        params: IdParams,
        body: ScenePatch,
        response: Scene,
    }),
    move: endpoint({
        method: 'PATCH',
        path: '/scenes/:id/position',
        params: IdParams,
        body: MoveBody,
        response: Scene,
    }),
    delete: endpoint({ method: 'DELETE', path: '/scenes/:id', params: IdParams, response: null }),
    duplicate: endpoint({
        method: 'POST',
        path: '/scenes/:id/duplicate',
        params: IdParams,
        response: Scene,
        status: 201,
    }),
    exportJson: endpoint({
        method: 'POST',
        path: '/scenes/export-json',
        body: SceneJsonExportBody,
        response: SceneJsonFile,
    }),
    importJson: endpoint({
        method: 'POST',
        path: '/scenes/import-json',
        body: SceneJsonImportBody,
        response: SceneImportResult,
        status: 201,
    }),
}

export const images = {
    list: endpoint({
        method: 'GET',
        path: '/images',
        query: ImageListQuery,
        response: z.array(Image),
    }),
    move: endpoint({
        method: 'PATCH',
        path: '/images/:id/position',
        params: IdParams,
        body: MoveBody,
        response: Image,
    }),
    delete: endpoint({ method: 'DELETE', path: '/images/:id', params: IdParams, response: null }),
}
