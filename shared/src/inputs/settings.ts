import * as z from 'zod'

import { PromptVariable } from '../schemas/common'
import { ImageSaveType, NovelAIMode } from '../schemas/settings'

/** Deep-partial settings update without defaults; the server merges it into stored settings. */
export const SettingsPatch = z.object({
    globalVariables: PromptVariable.optional(),
    image: z
        .object({
            sourceType: ImageSaveType.optional(),
            thumbnailType: ImageSaveType.optional(),
            thumbnailSize: z.number().int().min(16).max(2048).optional(),
        })
        .optional(),
    debug: z
        .object({
            enabled: z.boolean().optional(),
            recentRequestLimit: z.number().int().min(1).max(500).optional(),
        })
        .optional(),
    novelai: z.object({ mode: NovelAIMode.optional() }).optional(),
})
export type SettingsPatch = z.infer<typeof SettingsPatch>

export const NovelAIKeyBody = z.object({ apiKey: z.string().trim().min(1) })
export type NovelAIKeyBody = z.infer<typeof NovelAIKeyBody>

export const LoginBody = z.object({ token: z.string().min(1) })
export type LoginBody = z.infer<typeof LoginBody>
