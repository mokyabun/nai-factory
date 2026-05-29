import * as z from 'zod'
import { OptionalOrderBody, ProjectIdParams } from './common'

export type CharacterReferenceUploadFile = {
    name: string
    type: string
    arrayBuffer(): Promise<ArrayBuffer>
}

function isCharacterReferenceUploadFile(value: unknown): value is CharacterReferenceUploadFile {
    if (typeof value !== 'object' || value === null) return false

    const file = value as Partial<CharacterReferenceUploadFile>
    return (
        typeof file.name === 'string' &&
        typeof file.type === 'string' &&
        file.type.startsWith('image/') &&
        typeof file.arrayBuffer === 'function'
    )
}

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

export const CharacterReferenceImageUpload = z.custom<CharacterReferenceUploadFile>(
    isCharacterReferenceUploadFile,
    'An image file is required.',
)

export const CharacterReferenceUploadBody = z.object({
    image: CharacterReferenceImageUpload,
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
export type CharacterReferenceImageUpload = z.infer<typeof CharacterReferenceImageUpload>
export type CharacterReferenceUploadBody = z.infer<typeof CharacterReferenceUploadBody>
export type CharacterReferencePatchBody = z.infer<typeof CharacterReferencePatchBody>
export type CharacterReferenceOrderPatchBody = z.infer<typeof CharacterReferenceOrderPatchBody>
