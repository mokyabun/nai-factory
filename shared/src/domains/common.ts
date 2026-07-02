import * as z from 'zod'

export type ImageUploadFile = {
    name: string
    size: number
    type: string
    arrayBuffer(): Promise<ArrayBuffer>
}

function isImageUploadFile(value: unknown): value is ImageUploadFile {
    if (typeof value !== 'object' || value === null) return false

    const file = value as Partial<ImageUploadFile>
    return (
        typeof file.name === 'string' &&
        typeof file.size === 'number' &&
        typeof file.type === 'string' &&
        file.type.startsWith('image/') &&
        typeof file.arrayBuffer === 'function'
    )
}

export const IdParams = z.object({
    id: z.coerce.number().int().positive(),
})

export const ProjectIdParams = z.object({
    projectId: z.coerce.number().int().positive(),
})

export const OptionalOrderBody = z.object({
    prevId: z.number().int().positive().nullable(),
    nextId: z.number().int().positive().nullable(),
})

export const ImageUpload = z.custom<ImageUploadFile>(
    isImageUploadFile,
    'An image file is required.',
)

export type ImageUpload = z.infer<typeof ImageUpload>
export type IdParams = z.infer<typeof IdParams>
export type ProjectIdParams = z.infer<typeof ProjectIdParams>
export type OptionalOrderBody = z.infer<typeof OptionalOrderBody>
