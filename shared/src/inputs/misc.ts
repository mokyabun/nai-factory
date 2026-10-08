import * as z from 'zod'

export const SdStudioImportOptions = z.object({
    importPrompt: z.boolean().optional(),
    importNegativePrompt: z.boolean().optional(),
    importScenes: z.boolean().optional(),
    importCharacterPrompts: z.boolean().optional(),
    importParameters: z.boolean().optional(),
})
export type SdStudioImportOptions = z.infer<typeof SdStudioImportOptions>

export const SdStudioImportBody = z.object({
    projectId: z.number().int().positive(),
    data: z.unknown(),
    options: SdStudioImportOptions.optional(),
})
export type SdStudioImportBody = z.infer<typeof SdStudioImportBody>

export const TagAutocompleteQuery = z.object({
    q: z.string().min(1),
    limit: z.coerce.number().int().min(1).max(100).optional(),
})
export type TagAutocompleteQuery = z.infer<typeof TagAutocompleteQuery>

export const GcQuery = z.object({
    apply: z
        .enum(['true', 'false'])
        .transform((value) => value === 'true')
        .optional(),
})
export type GcQuery = z.infer<typeof GcQuery>
