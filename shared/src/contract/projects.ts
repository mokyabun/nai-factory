import * as z from 'zod'

import { ArchiveExportBody, ArchiveImportBody } from '../inputs/archive'
import { IdParams, ImageUploadBody } from '../inputs/common'
import {
    ProjectCreateBody,
    ProjectDuplicateBody,
    ProjectExportBody,
    ProjectListQuery,
    ProjectPatch,
    ProjectServerExportBody,
} from '../inputs/projects'
import { Project, ProjectExportResult } from '../schemas/project'
import { CharacterReference, VibeTransfer } from '../schemas/references'
import { endpoint } from './define'

export const projects = {
    list: endpoint({
        method: 'GET',
        path: '/projects',
        query: ProjectListQuery,
        response: z.array(Project),
    }),
    get: endpoint({ method: 'GET', path: '/projects/:id', params: IdParams, response: Project }),
    create: endpoint({
        method: 'POST',
        path: '/projects',
        body: ProjectCreateBody,
        response: Project,
        status: 201,
    }),
    update: endpoint({
        method: 'PATCH',
        path: '/projects/:id',
        params: IdParams,
        body: ProjectPatch,
        response: Project,
    }),
    delete: endpoint({
        method: 'DELETE',
        path: '/projects/:id',
        params: IdParams,
        response: null,
    }),
    duplicate: endpoint({
        method: 'POST',
        path: '/projects/:id/duplicate',
        params: IdParams,
        body: ProjectDuplicateBody,
        response: Project,
        status: 201,
    }),
    exportArchive: endpoint({
        method: 'POST',
        path: '/projects/:id/archive',
        params: IdParams,
        body: ArchiveExportBody,
        response: 'binary',
    }),
    importArchive: endpoint({
        method: 'POST',
        path: '/projects/import',
        body: ArchiveImportBody,
        bodyType: 'form',
        response: Project,
        status: 201,
    }),
    exportFiles: endpoint({
        method: 'POST',
        path: '/projects/:id/export/files',
        params: IdParams,
        body: ProjectExportBody,
        response: ProjectExportResult,
    }),
    exportZip: endpoint({
        method: 'POST',
        path: '/projects/:id/export/zip',
        params: IdParams,
        body: ProjectExportBody,
        response: 'binary',
    }),
    exportServer: endpoint({
        method: 'POST',
        path: '/projects/:id/export/server',
        params: IdParams,
        body: ProjectServerExportBody,
        response: ProjectExportResult,
    }),
    vibeTransfers: endpoint({
        method: 'GET',
        path: '/projects/:id/vibe-transfers',
        params: IdParams,
        response: z.array(VibeTransfer),
    }),
    uploadVibeTransfer: endpoint({
        method: 'POST',
        path: '/projects/:id/vibe-transfers',
        params: IdParams,
        body: ImageUploadBody,
        bodyType: 'form',
        response: VibeTransfer,
        status: 201,
    }),
    characterReferences: endpoint({
        method: 'GET',
        path: '/projects/:id/character-references',
        params: IdParams,
        response: z.array(CharacterReference),
    }),
    uploadCharacterReference: endpoint({
        method: 'POST',
        path: '/projects/:id/character-references',
        params: IdParams,
        body: ImageUploadBody,
        bodyType: 'form',
        response: CharacterReference,
        status: 201,
    }),
}
