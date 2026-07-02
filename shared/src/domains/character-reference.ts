import * as z from 'zod'
import { ImageUpload, OptionalOrderBody, ProjectIdParams } from './common'

export const CharacterReference = z.object({
    id: z.number(),
    projectId: z.number(),

    displayOrder: z.string(),
    sourceImagePath: z.string(),
    thumbnailPath: z.string().nullable(),
    processedImagePath: z.string().nullable(),

    strength: z.number(),
    fidelity: z.number(),
    referenceMode: z.string(),
    enabled: z.boolean(),

    cacheSecretKey: z.string().nullable(),
    cacheCreatedAt: z.string().nullable(),

    createdAt: z.string(),
    updatedAt: z.string(),
})

export const CharacterReferenceItemParams = ProjectIdParams.extend({
    id: z.coerce.number().int().positive(),
})

export const CharacterReferenceUploadBody = z.object({
    image: ImageUpload,
})

export const CharacterReferencePatchBody = z.object({
    strength: z.number().min(0).max(1).optional(),
    fidelity: z.number().min(0).max(1).optional(),
    referenceMode: z.enum(['character', 'style', 'character&style']).optional(),
    enabled: z.boolean().optional(),
})

export const CharacterReferenceOrderPatchBody = OptionalOrderBody.extend({
    id: z.number().int().positive(),
})

export type CharacterReference = z.infer<typeof CharacterReference>
export type CharacterReferenceItemParams = z.infer<typeof CharacterReferenceItemParams>
export type CharacterReferenceUploadBody = z.infer<typeof CharacterReferenceUploadBody>
export type CharacterReferencePatchBody = z.infer<typeof CharacterReferencePatchBody>
export type CharacterReferenceOrderPatchBody = z.infer<typeof CharacterReferenceOrderPatchBody>
