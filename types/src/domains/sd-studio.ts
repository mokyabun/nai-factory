import * as z from 'zod'

export const SdStudioImportOptions = z.object({
    importPrompt: z.boolean().optional(),
    importNegativePrompt: z.boolean().optional(),
    importScenes: z.boolean().optional(),
    importCharacterPrompts: z.boolean().optional(),
    importParameters: z.boolean().optional(),
})

export const ImportSdStudioBody = z.object({
    projectId: z.number(),
    data: z.unknown(),
    options: SdStudioImportOptions.optional(),
})

export type SdStudioImportOptions = z.infer<typeof SdStudioImportOptions>
export type ImportSdStudioBody = z.infer<typeof ImportSdStudioBody>
