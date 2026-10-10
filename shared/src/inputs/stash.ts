import * as z from 'zod'

import {
    StashParametersPayload,
    StashPromptPayload,
    StashScenePayload,
    StashType,
} from '../schemas/stash'
import { SceneImportMode } from './scenes'

export const StashListQuery = z.object({ type: StashType.optional() })
export type StashListQuery = z.infer<typeof StashListQuery>

export const StashCreateBody = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('prompt'),
        name: z.string().trim().min(1),
        payload: StashPromptPayload,
    }),
    z.object({
        type: z.literal('scene'),
        name: z.string().trim().min(1),
        payload: StashScenePayload,
    }),
    z.object({
        type: z.literal('parameters'),
        name: z.string().trim().min(1),
        payload: StashParametersPayload,
    }),
])
export type StashCreateBody = z.infer<typeof StashCreateBody>

/** `payload` is validated against the stored item's type on the server. */
export const StashPatch = z.object({
    name: z.string().trim().min(1).optional(),
    payload: z.unknown().optional(),
})
export type StashPatch = z.infer<typeof StashPatch>

export const StashApplyBody = z.object({
    projectId: z.number().int().positive(),
    mode: SceneImportMode.optional(),
})
export type StashApplyBody = z.infer<typeof StashApplyBody>

export const StashCaptureScenesBody = z.object({
    projectId: z.number().int().positive(),
    sceneIds: z.array(z.number().int().positive()).optional(),
})
export type StashCaptureScenesBody = z.infer<typeof StashCaptureScenesBody>
