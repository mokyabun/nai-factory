import * as z from 'zod'

import { NovelAIModel } from '../novelai'
import { AssetKind } from './asset'
import { CharacterPrompt, IsoDateTime, Parameters, PromptVariable } from './common'
import { ImageMetadata } from './image'
import { ProjectSettings } from './project'
import { CharacterReferenceMode } from './references'

export const PROJECT_ARCHIVE_FORMAT = 'nai-factory.project'
export const PROJECT_ARCHIVE_FORMAT_VERSION = 3
export const PROJECT_ARCHIVE_EXTENSION = 'naif'

export const ArchiveInclude = z.object({
    prompts: z.boolean(),
    parameters: z.boolean(),
    scenes: z.boolean(),
    images: z.boolean(),
    characterReferences: z.boolean(),
    vibeTransfers: z.boolean(),
})
export type ArchiveInclude = z.infer<typeof ArchiveInclude>

export const DEFAULT_ARCHIVE_INCLUDE: ArchiveInclude = {
    prompts: true,
    parameters: true,
    scenes: true,
    images: false,
    characterReferences: true,
    vibeTransfers: true,
}

export const ArchiveEntryPath = z
    .string()
    .regex(/^assets\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/, 'Invalid archive asset path')

export const ArchiveAsset = z.object({
    id: z.string().min(1),
    kind: AssetKind,
    path: ArchiveEntryPath,
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    size: z.number().int().nonnegative(),
})
export type ArchiveAsset = z.infer<typeof ArchiveAsset>

export const ArchiveImage = z.object({
    position: z.string(),
    assetId: z.string(),
    thumbAssetId: z.string(),
    seed: z.number().nullable(),
    metadata: ImageMetadata,
    createdAt: IsoDateTime,
})
export type ArchiveImage = z.infer<typeof ArchiveImage>

export const ArchiveScene = z.object({
    name: z.string(),
    position: z.string(),
    variations: z.array(z.object({ position: z.string(), variables: PromptVariable })),
    images: z.array(ArchiveImage),
})
export type ArchiveScene = z.infer<typeof ArchiveScene>

export const ArchiveCharacterReference = z.object({
    position: z.string(),
    sourceAssetId: z.string(),
    thumbAssetId: z.string().nullable(),
    processedAssetId: z.string().nullable(),
    strength: z.number(),
    fidelity: z.number(),
    mode: CharacterReferenceMode,
    enabled: z.boolean(),
})
export type ArchiveCharacterReference = z.infer<typeof ArchiveCharacterReference>

export const ArchiveVibeTransfer = z.object({
    position: z.string(),
    sourceAssetId: z.string(),
    encodedAssetId: z.string().nullable(),
    encodedForModel: NovelAIModel.nullable(),
    encodedInformationExtracted: z.number().nullable(),
    referenceStrength: z.number(),
    informationExtracted: z.number(),
    enabled: z.boolean(),
})
export type ArchiveVibeTransfer = z.infer<typeof ArchiveVibeTransfer>

export const ArchiveManifest = z.object({
    format: z.literal(PROJECT_ARCHIVE_FORMAT),
    formatVersion: z.literal(PROJECT_ARCHIVE_FORMAT_VERSION),
    appVersion: z.string(),
    exportedAt: IsoDateTime,
    include: ArchiveInclude,
    project: z.object({
        name: z.string().min(1),
        prompt: z.string().nullable(),
        negativePrompt: z.string().nullable(),
        variables: PromptVariable.nullable(),
        characterPrompts: z.array(CharacterPrompt).nullable(),
        parameters: Parameters.nullable(),
        settings: ProjectSettings,
    }),
    scenes: z.array(ArchiveScene),
    characterReferences: z.array(ArchiveCharacterReference),
    vibeTransfers: z.array(ArchiveVibeTransfer),
    assets: z.array(ArchiveAsset),
})
export type ArchiveManifest = z.infer<typeof ArchiveManifest>
