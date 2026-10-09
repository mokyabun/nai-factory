import * as z from 'zod'

export const ImageListQuery = z.object({
    sceneId: z.coerce.number().int().positive(),
    variationId: z.coerce.number().int().positive().optional(),
})
export type ImageListQuery = z.infer<typeof ImageListQuery>

export const MAX_IMAGES_PER_DELETE = 10_000

export const ImageDeleteManyBody = z.object({
    ids: z.array(z.number().int().positive()).min(1).max(MAX_IMAGES_PER_DELETE),
})
export type ImageDeleteManyBody = z.infer<typeof ImageDeleteManyBody>
