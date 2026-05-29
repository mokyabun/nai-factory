import * as z from 'zod'
import { OptionalOrderBody, ProjectIdParams } from './common'

export type ImageUploadFile = {
    name: string
    type: string
    arrayBuffer(): Promise<ArrayBuffer>
}

function isImageUploadFile(value: unknown): value is ImageUploadFile {
    if (typeof value !== 'object' || value === null) return false

    const file = value as Partial<ImageUploadFile>
    return (
        typeof file.name === 'string' &&
        typeof file.type === 'string' &&
        file.type.startsWith('image/') &&
        typeof file.arrayBuffer === 'function'
    )
}

export const VibeTransfer = z.object({
    id: z.number(),
    projectId: z.number(),

    displayOrder: z.string(),
    sourceImagePath: z.string(),

    referenceStrength: z.number(),
    informationExtracted: z.number(),

    encodedData: z.string().nullable(),
    encodedInformationExtracted: z.number().nullable(),

    cacheSecretKey: z.string().nullable(),
    cacheCreatedAt: z.string().nullable(),

    createdAt: z.string(),
    updatedAt: z.string(),
})

export const VibeTransferItemParams = ProjectIdParams.extend({
    id: z.coerce.number().int().positive(),
})

export const ImageUpload = z.custom<ImageUploadFile>(
    isImageUploadFile,
    'An image file is required.',
)

export const VibeTransferUploadBody = z.object({
    image: ImageUpload,
})

export const VibeTransferPatchBody = z.object({
    referenceStrength: z.number().min(0).max(1).optional(),
    informationExtracted: z.number().min(0).max(1).optional(),
})

export const VibeTransferOrderPatchBody = OptionalOrderBody.extend({
    id: z.number().int().positive(),
})

export const VibeTransferParams = VibeTransferItemParams
export const UploadVibeTransferBody = VibeTransferUploadBody
export const UpdateVibeTransferBody = VibeTransferPatchBody
export const ReorderVibeTransferBody = VibeTransferOrderPatchBody

export type VibeTransfer = z.infer<typeof VibeTransfer>
export type VibeTransferItemParams = z.infer<typeof VibeTransferItemParams>
export type ImageUpload = z.infer<typeof ImageUpload>
export type VibeTransferUploadBody = z.infer<typeof VibeTransferUploadBody>
export type VibeTransferPatchBody = z.infer<typeof VibeTransferPatchBody>
export type VibeTransferOrderPatchBody = z.infer<typeof VibeTransferOrderPatchBody>
export type VibeTransferParams = VibeTransferItemParams
export type UploadVibeTransferBody = VibeTransferUploadBody
export type UpdateVibeTransferBody = VibeTransferPatchBody
export type ReorderVibeTransferBody = VibeTransferOrderPatchBody
