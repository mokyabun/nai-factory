import * as z from 'zod'

import { CharacterPrompt, IsoDateTime, Parameters, PromptVariable } from './common'
import { MAX_IMAGES_PER_JOB } from './job'

export const DEFAULT_OUTPUT_TEMPLATE = '{character}-{scene}-{number}.{extension}'

/** Defaults fill in fields missing from stored JSON; request schemas never use them. */
export const ProjectSettings = z.object({
    slideshowImageCount: z.number().int().min(1).max(10).default(4),
    sceneCardSize: z.enum(['sm', 'md', 'lg']).default('md'),
    outputTemplate: z.string().min(1).default(DEFAULT_OUTPUT_TEMPLATE),
    /** Images per variation when scenes are queued. */
    defaultImageCount: z.number().int().min(1).max(MAX_IMAGES_PER_JOB).default(1),
})
export type ProjectSettings = z.infer<typeof ProjectSettings>

export const Project = z.object({
    id: z.number(),
    groupId: z.number().nullable(),
    name: z.string(),
    prompt: z.string(),
    negativePrompt: z.string(),
    variables: PromptVariable,
    parameters: Parameters,
    characterPrompts: z.array(CharacterPrompt),
    settings: ProjectSettings,
    createdAt: IsoDateTime,
    updatedAt: IsoDateTime,
})
export type Project = z.infer<typeof Project>

export const ProjectExportAsset = z.object({
    imageId: z.number(),
    assetId: z.number(),
    sceneId: z.number(),
    sceneName: z.string(),
    filename: z.string(),
})
export type ProjectExportAsset = z.infer<typeof ProjectExportAsset>

export const ProjectExportResult = z.object({
    exported: z.number(),
    assets: z.array(ProjectExportAsset),
})
export type ProjectExportResult = z.infer<typeof ProjectExportResult>
