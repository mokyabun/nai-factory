import * as z from 'zod'
import { IdParams } from './shared'

export { IdParams as ImageIdParams }

export const ImageListQuery = z.object({
    sceneId: z.coerce.number(),
})

export const ReorderImageBody = z.object({
    prevId: z.number().nullable(),
    nextId: z.number().nullable(),
})

export type ImageListQuery = z.infer<typeof ImageListQuery>
export type ReorderImageBody = z.infer<typeof ReorderImageBody>
