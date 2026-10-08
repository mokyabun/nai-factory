import * as z from 'zod'

import { IsoDateTime, Parameters } from './common'
import { ImageMetadata } from './image'

export const PlaygroundState = z.object({
    prompt: z.string(),
    negativePrompt: z.string(),
    parameters: Parameters,
    updatedAt: IsoDateTime,
})
export type PlaygroundState = z.infer<typeof PlaygroundState>

export const PlaygroundImage = z.object({
    id: z.number(),
    assetId: z.number(),
    thumbAssetId: z.number(),
    prompt: z.string(),
    negativePrompt: z.string(),
    parameters: Parameters,
    seed: z.number().nullable(),
    metadata: ImageMetadata,
    createdAt: IsoDateTime,
})
export type PlaygroundImage = z.infer<typeof PlaygroundImage>
