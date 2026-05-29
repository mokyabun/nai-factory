import * as z from 'zod'
import { Parameters } from '../app'
import { EnqueuePosition } from './queue'

export const PlaygroundImage = z.object({
    id: z.number(),
    prompt: z.string(),
    negativePrompt: z.string(),
    parameters: Parameters,
    filePath: z.string(),
    thumbnailPath: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()),
    createdAt: z.string(),
})

export const PlaygroundImageGetQuery = z.object({
    limit: z.coerce.number().int().positive().max(100).optional(),
})

export const PlaygroundEnqueueBody = z.object({
    prompt: z.string().trim().min(1),
    negativePrompt: z.string().default(''),
    parameters: Parameters,
    position: EnqueuePosition.optional(),
})

export const PlaygroundSettings = z.object({
    id: z.number(),
    prompt: z.string(),
    negativePrompt: z.string(),
    parameters: Parameters,
    updatedAt: z.string(),
})

export const PlaygroundSettingsPatchBody = z.object({
    prompt: z.string().optional(),
    negativePrompt: z.string().optional(),
    parameters: Parameters.optional(),
})

export type PlaygroundImage = z.infer<typeof PlaygroundImage>
export type PlaygroundImageGetQuery = z.infer<typeof PlaygroundImageGetQuery>
export type PlaygroundEnqueueBody = z.infer<typeof PlaygroundEnqueueBody>
export type PlaygroundSettings = z.infer<typeof PlaygroundSettings>
export type PlaygroundSettingsPatchBody = z.infer<typeof PlaygroundSettingsPatchBody>
