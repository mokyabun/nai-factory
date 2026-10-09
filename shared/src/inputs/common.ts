import * as z from 'zod'

export const IdParam = z.coerce.number().int().positive()

export const IdParams = z.object({ id: IdParam })
export type IdParams = z.infer<typeof IdParams>

/** `beforeId` and `afterId` are the new neighbors; null means the start or end of the list. */
export const MoveBody = z.object({
    beforeId: z.number().int().positive().nullable(),
    afterId: z.number().int().positive().nullable(),
})
export type MoveBody = z.infer<typeof MoveBody>

/** Blob covers both browser File objects and Bun's File. */
export const UploadFile = z.custom<Blob>(
    (value) => typeof Blob !== 'undefined' && value instanceof Blob,
    'A file is required.',
)
export type UploadFile = z.infer<typeof UploadFile>

export const ImageUploadBody = z.object({ image: UploadFile })
export type ImageUploadBody = z.infer<typeof ImageUploadBody>

export const EmptyBody = z.object({})
export type EmptyBody = z.infer<typeof EmptyBody>
