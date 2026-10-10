import * as z from 'zod'

import { CharacterPrompt, IsoDateTime, PromptVariable } from './common'
import { ImageThumb } from './image'

export const SceneVariation = z.object({
    id: z.number(),
    sceneId: z.number(),
    position: z.string(),
    variables: PromptVariable,
    createdAt: IsoDateTime,
    updatedAt: IsoDateTime,
})
export type SceneVariation = z.infer<typeof SceneVariation>

export const Scene = z.object({
    id: z.number(),
    projectId: z.number(),
    name: z.string(),
    position: z.string(),
    variations: z.array(SceneVariation),
    createdAt: IsoDateTime,
    updatedAt: IsoDateTime,
})
export type Scene = z.infer<typeof Scene>

export const SceneSummary = Scene.extend({
    imageCount: z.number(),
    /** Queued or running jobs for this scene. */
    queueCount: z.number(),
    latestImages: z.array(ImageThumb),
})
export type SceneSummary = z.infer<typeof SceneSummary>

export const ScenePreviewPrompt = z.object({
    prompt: z.string(),
    negativePrompt: z.string(),
    characterPrompts: z.array(CharacterPrompt),
})
export type ScenePreviewPrompt = z.infer<typeof ScenePreviewPrompt>

export const ScenePreviewResult = z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), prompts: z.array(ScenePreviewPrompt) }),
    z.object({
        ok: z.literal(false),
        error: z.object({ message: z.string(), category: z.string() }),
    }),
])
export type ScenePreviewResult = z.infer<typeof ScenePreviewResult>

export const SceneJsonScene = z.object({
    name: z.string().min(1),
    variations: z.array(z.object({ variables: PromptVariable })),
})
export type SceneJsonScene = z.infer<typeof SceneJsonScene>

export const SceneJsonFile = z.object({ scenes: z.array(SceneJsonScene) })
export type SceneJsonFile = z.infer<typeof SceneJsonFile>

export const SceneJsonData = z.union([SceneJsonFile, z.array(SceneJsonScene), SceneJsonScene])
export type SceneJsonData = z.infer<typeof SceneJsonData>

export const SceneImportResult = z.object({ imported: z.number() })
export type SceneImportResult = z.infer<typeof SceneImportResult>
