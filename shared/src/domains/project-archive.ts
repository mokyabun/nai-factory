import * as z from 'zod'
import { CharacterPrompt, Parameters, PromptVariable } from '../app'
import { ProjectSettings } from './project'

export type ProjectArchiveUploadFile = {
    name: string
    size: number
    type: string
    arrayBuffer(): Promise<ArrayBuffer>
}

function isProjectArchiveUploadFile(value: unknown): value is ProjectArchiveUploadFile {
    if (typeof value !== 'object' || value === null) return false

    const file = value as Partial<ProjectArchiveUploadFile>
    return (
        typeof file.name === 'string' &&
        typeof file.size === 'number' &&
        typeof file.type === 'string' &&
        typeof file.arrayBuffer === 'function'
    )
}

export const PROJECT_ARCHIVE_FORMAT = 'nai-factory.project'
export const PROJECT_ARCHIVE_FORMAT_VERSION = 2
export const PROJECT_ARCHIVE_EXTENSION = 'naif'

export const ProjectArchiveIncludeOptions = z.object({
    prompts: z.boolean().default(true),
    parameters: z.boolean().default(true),
    scenes: z.boolean().default(true),
    characterReferences: z.boolean().default(true),
    vibeTransfers: z.boolean().default(true),
    images: z.boolean().default(false),
})

export type ProjectArchiveIncludeOptions = z.infer<typeof ProjectArchiveIncludeOptions>

export const DEFAULT_PROJECT_ARCHIVE_INCLUDE_OPTIONS: ProjectArchiveIncludeOptions = {
    prompts: true,
    parameters: true,
    scenes: true,
    characterReferences: true,
    vibeTransfers: true,
    images: false,
}

export const ProjectArchiveExportBody = z.object({
    include: ProjectArchiveIncludeOptions.partial().default({}),
})

export const ProjectArchiveImportBody = z.object({
    archive: z.custom<ProjectArchiveUploadFile>(
        isProjectArchiveUploadFile,
        'A .naif archive file is required.',
    ),
})

export const ProjectArchiveAssetKind = z.enum([
    'image',
    'image-thumbnail',
    'character-reference-source',
    'character-reference-thumbnail',
    'character-reference-processed',
    'vibe-source',
])

export const ProjectArchiveAsset = z.object({
    id: z.string(),
    kind: ProjectArchiveAssetKind,
    path: z.string(),
    filename: z.string(),
    contentType: z.string(),
    size: z.number().int().nonnegative().optional(),
    sha256: z.string().optional(),
})

export const ProjectArchiveSceneVariation = z.object({
    localId: z.string(),
    displayOrder: z.string(),
    variables: PromptVariable,
    originalId: z.number().optional(),
})

export const ProjectArchiveImage = z.object({
    localId: z.string(),
    displayOrder: z.string(),
    assetId: z.string().optional(),
    thumbnailAssetId: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
    createdAt: z.string().optional(),
    originalId: z.number().optional(),
})

export const ProjectArchiveScene = z.object({
    localId: z.string(),
    name: z.string(),
    displayOrder: z.string(),
    variations: z.array(ProjectArchiveSceneVariation).default([]),
    images: z.array(ProjectArchiveImage).default([]),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    originalId: z.number().optional(),
})

export const ProjectArchiveCharacterReference = z.object({
    localId: z.string(),
    displayOrder: z.string(),
    sourceAssetId: z.string().optional(),
    thumbnailAssetId: z.string().optional(),
    processedAssetId: z.string().optional(),
    strength: z.number(),
    fidelity: z.number(),
    referenceMode: z.enum(['character', 'style', 'character&style']),
    enabled: z.boolean(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    originalId: z.number().optional(),
})

export const ProjectArchiveVibeTransfer = z.object({
    localId: z.string(),
    displayOrder: z.string(),
    sourceAssetId: z.string().optional(),
    referenceStrength: z.number(),
    informationExtracted: z.number(),
    encodedData: z.string().nullable().optional(),
    encodedInformationExtracted: z.number().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    originalId: z.number().optional(),
})

const ProjectArchiveProject = z.object({
    name: z.string(),
    prompt: z.string().optional(),
    negativePrompt: z.string().optional(),
    variables: PromptVariable.optional(),
    parameters: Parameters.optional(),
    characterPrompts: z.array(CharacterPrompt).optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    originalId: z.number().optional(),
})

export const ProjectArchiveV2 = z.object({
    format: z.literal(PROJECT_ARCHIVE_FORMAT),
    formatVersion: z.literal(PROJECT_ARCHIVE_FORMAT_VERSION),
    appVersion: z.string().optional(),
    exportedAt: z.string(),
    include: ProjectArchiveIncludeOptions,
    project: ProjectArchiveProject,
    scenes: z.array(ProjectArchiveScene).default([]),
    characterReferences: z.array(ProjectArchiveCharacterReference).default([]),
    vibeTransfers: z.array(ProjectArchiveVibeTransfer).default([]),
    assets: z.array(ProjectArchiveAsset).default([]),
})

const LegacyProjectArchiveIncludeOptions = z.object({
    projectPrompt: z.boolean().default(true),
    projectVariables: z.boolean().default(true),
    projectParameters: z.boolean().default(true),
    projectSettings: z.boolean().default(true),
    characterPrompts: z.boolean().default(true),
    scenes: z.boolean().default(true),
    sceneVariations: z.boolean().default(true),
    characterReferences: z.boolean().default(true),
    vibeTransfers: z.boolean().default(true),
    images: z.boolean().default(false),
    imageMetadata: z.boolean().default(true),
    thumbnails: z.boolean().default(false),
    derivedCaches: z.boolean().default(false),
})

export const ProjectArchiveV1 = z.object({
    format: z.literal(PROJECT_ARCHIVE_FORMAT),
    formatVersion: z.literal(1),
    appVersion: z.string().optional(),
    exportedAt: z.string(),
    include: LegacyProjectArchiveIncludeOptions,
    project: ProjectArchiveProject.extend({
        settings: ProjectSettings.partial().optional(),
    }),
    scenes: z.array(ProjectArchiveScene).default([]),
    characterReferences: z.array(ProjectArchiveCharacterReference).default([]),
    vibeTransfers: z.array(ProjectArchiveVibeTransfer).default([]),
    assets: z.array(ProjectArchiveAsset).default([]),
})

export const ProjectArchiveManifest = z.union([ProjectArchiveV2, ProjectArchiveV1])

export type ProjectArchiveExportBody = z.infer<typeof ProjectArchiveExportBody>
export type ProjectArchiveImportBody = z.infer<typeof ProjectArchiveImportBody>
export type ProjectArchiveAssetKind = z.infer<typeof ProjectArchiveAssetKind>
export type ProjectArchiveAsset = z.infer<typeof ProjectArchiveAsset>
export type ProjectArchiveSceneVariation = z.infer<typeof ProjectArchiveSceneVariation>
export type ProjectArchiveImage = z.infer<typeof ProjectArchiveImage>
export type ProjectArchiveScene = z.infer<typeof ProjectArchiveScene>
export type ProjectArchiveCharacterReference = z.infer<typeof ProjectArchiveCharacterReference>
export type ProjectArchiveVibeTransfer = z.infer<typeof ProjectArchiveVibeTransfer>
export type ProjectArchiveManifest = z.infer<typeof ProjectArchiveManifest>
