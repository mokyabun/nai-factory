import * as z from 'zod'

import { PromptVariable } from '../schemas/common'
import { SceneJsonData } from '../schemas/scene'

export const SceneListQuery = z.object({ projectId: z.coerce.number().int().positive() })
export type SceneListQuery = z.infer<typeof SceneListQuery>

export const SceneCreateBody = z.object({
    projectId: z.number().int().positive(),
    name: z.string().trim().min(1),
})
export type SceneCreateBody = z.infer<typeof SceneCreateBody>

/** A variation in a full-list scene update; items without an id are created. */
export const VariationDraft = z.object({
    id: z.number().int().optional(),
    variables: PromptVariable,
})
export type VariationDraft = z.infer<typeof VariationDraft>

export const ScenePatch = z.object({
    name: z.string().trim().min(1).optional(),
    /** The complete, ordered variation list. */
    variations: z.array(VariationDraft).optional(),
})
export type ScenePatch = z.infer<typeof ScenePatch>

export const ScenePreviewQuery = z.object({
    variationId: z.coerce.number().int().positive().optional(),
})
export type ScenePreviewQuery = z.infer<typeof ScenePreviewQuery>

export const SceneImportMode = z.enum(['append', 'replace'])
export type SceneImportMode = z.infer<typeof SceneImportMode>

export const SceneJsonExportBody = z.object({
    projectId: z.number().int().positive(),
    sceneIds: z.array(z.number().int().positive()).optional(),
})
export type SceneJsonExportBody = z.infer<typeof SceneJsonExportBody>

export const SceneJsonImportBody = z.object({
    projectId: z.number().int().positive(),
    data: SceneJsonData,
    mode: SceneImportMode.optional(),
})
export type SceneJsonImportBody = z.infer<typeof SceneJsonImportBody>
