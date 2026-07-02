import * as z from 'zod'

export const ImportOptions = z.object({
    importPrompt: z.boolean().optional(),
    importNegativePrompt: z.boolean().optional(),
    importScenes: z.boolean().optional(),
    importCharacterPrompts: z.boolean().optional(),
    importParameters: z.boolean().optional(),
})

export const SdStudioImportBody = z.object({
    projectId: z.number().int().positive(),
    data: z.unknown(),
    options: ImportOptions.optional(),
})

export type ImportOptions = z.infer<typeof ImportOptions>
export type SdStudioImportBody = z.infer<typeof SdStudioImportBody>
