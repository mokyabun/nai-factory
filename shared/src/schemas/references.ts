import * as z from 'zod'

import { IsoDateTime } from './common'

export const CHARACTER_REFERENCE_MODES = ['character', 'style', 'character&style'] as const
export const CharacterReferenceMode = z.enum(CHARACTER_REFERENCE_MODES)
export type CharacterReferenceMode = z.infer<typeof CharacterReferenceMode>

export const VibeTransfer = z.object({
    id: z.number(),
    projectId: z.number(),
    position: z.string(),
    sourceAssetId: z.number(),
    referenceStrength: z.number(),
    informationExtracted: z.number(),
    enabled: z.boolean(),
    /** Whether an encoding for the current settings is cached on the server. */
    encoded: z.boolean(),
    createdAt: IsoDateTime,
    updatedAt: IsoDateTime,
})
export type VibeTransfer = z.infer<typeof VibeTransfer>

export const CharacterReference = z.object({
    id: z.number(),
    projectId: z.number(),
    position: z.string(),
    sourceAssetId: z.number(),
    thumbAssetId: z.number().nullable(),
    strength: z.number(),
    fidelity: z.number(),
    mode: CharacterReferenceMode,
    enabled: z.boolean(),
    createdAt: IsoDateTime,
    updatedAt: IsoDateTime,
})
export type CharacterReference = z.infer<typeof CharacterReference>
