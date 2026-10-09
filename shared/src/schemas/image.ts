import * as z from 'zod'

import { IsoDateTime } from './common'

export const ImageMetadata = z.record(z.string(), z.unknown())
export type ImageMetadata = z.infer<typeof ImageMetadata>

export const Image = z.object({
    id: z.number(),
    sceneId: z.number(),
    position: z.string(),
    assetId: z.number(),
    thumbAssetId: z.number(),
    seed: z.number().nullable(),
    metadata: ImageMetadata,
    createdAt: IsoDateTime,
})
export type Image = z.infer<typeof Image>

export const ImageThumb = Image.pick({
    id: true,
    position: true,
    assetId: true,
    thumbAssetId: true,
    createdAt: true,
})
export type ImageThumb = z.infer<typeof ImageThumb>

export const ImageDeleteManyResult = z.object({ deleted: z.number() })
export type ImageDeleteManyResult = z.infer<typeof ImageDeleteManyResult>
