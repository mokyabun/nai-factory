import * as z from 'zod'
import { ImageUpload, OptionalOrderBody, ProjectIdParams } from './common'

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

export type VibeTransfer = z.infer<typeof VibeTransfer>
export type VibeTransferItemParams = z.infer<typeof VibeTransferItemParams>
export type VibeTransferUploadBody = z.infer<typeof VibeTransferUploadBody>
export type VibeTransferPatchBody = z.infer<typeof VibeTransferPatchBody>
export type VibeTransferOrderPatchBody = z.infer<typeof VibeTransferOrderPatchBody>
