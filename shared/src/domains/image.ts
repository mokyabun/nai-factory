import * as z from 'zod'
import { IdParams, OptionalOrderBody } from './common'

export const Image = z.object({
    id: z.number(),
    sceneId: z.number(),

    displayOrder: z.string(),
    filePath: z.string(),
    thumbnailPath: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()),

    createdAt: z.string(),
})

export const ImageGetQuery = z.object({
    sceneId: z.coerce.number().int().positive(),
})

export const ImagePatchBody = z.object({
    displayOrder: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
})

export const ImageOrderPatchBody = OptionalOrderBody

export const ImageIdParams = IdParams
export const ImageListQuery = ImageGetQuery
export const ReorderImageBody = ImageOrderPatchBody

export type Image = z.infer<typeof Image>
export type ImageGetQuery = z.infer<typeof ImageGetQuery>
export type ImagePatchBody = z.infer<typeof ImagePatchBody>
export type ImageOrderPatchBody = z.infer<typeof ImageOrderPatchBody>
export type ImageIdParams = z.infer<typeof ImageIdParams>
export type ImageListQuery = ImageGetQuery
export type ReorderImageBody = ImageOrderPatchBody
