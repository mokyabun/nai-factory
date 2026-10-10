import * as z from 'zod'

import { UploadFile } from './common'

export const ArchiveExportBody = z.object({
    include: z
        .object({
            prompts: z.boolean().optional(),
            parameters: z.boolean().optional(),
            scenes: z.boolean().optional(),
            images: z.boolean().optional(),
            characterReferences: z.boolean().optional(),
            vibeTransfers: z.boolean().optional(),
        })
        .optional(),
})
export type ArchiveExportBody = z.infer<typeof ArchiveExportBody>

export const ArchiveImportBody = z.object({ archive: UploadFile })
export type ArchiveImportBody = z.infer<typeof ArchiveImportBody>
