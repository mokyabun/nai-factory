import * as z from 'zod'

export const ImageListQuery = z.object({ sceneId: z.coerce.number().int().positive() })
export type ImageListQuery = z.infer<typeof ImageListQuery>
