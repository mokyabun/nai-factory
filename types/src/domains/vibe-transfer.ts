import * as z from 'zod'
import { ProjectIdParams } from './shared'

export { ProjectIdParams }

export const VibeTransferParams = ProjectIdParams.extend({
    id: z.coerce.number(),
})

export interface ImageUploadFile {
    name: string
    type: string
    arrayBuffer(): Promise<ArrayBuffer>
}

function isImageUploadFile(value: unknown): value is ImageUploadFile {
    if (!value || typeof value !== 'object') return false

    const file = value as Partial<ImageUploadFile>
    return (
        typeof file.name === 'string' &&
        typeof file.type === 'string' &&
        file.type.startsWith('image/') &&
        typeof file.arrayBuffer === 'function'
    )
}

export const UploadVibeTransferBody = z.object({
    image: z.custom<ImageUploadFile>(isImageUploadFile, 'Image file is required'),
})

export const UpdateVibeTransferBody = z.object({
    referenceStrength: z.number().min(0).max(1).optional(),
    informationExtracted: z.number().min(0).max(1).optional(),
})

export const ReorderVibeTransferBody = z.object({
    id: z.number(),
    prevId: z.number().nullable(),
    nextId: z.number().nullable(),
})

export type VibeTransferParams = z.infer<typeof VibeTransferParams>
export type UploadVibeTransferBody = z.infer<typeof UploadVibeTransferBody>
export type UpdateVibeTransferBody = z.infer<typeof UpdateVibeTransferBody>
export type ReorderVibeTransferBody = z.infer<typeof ReorderVibeTransferBody>
