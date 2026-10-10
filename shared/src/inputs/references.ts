import * as z from 'zod'

import { CharacterReferenceMode } from '../schemas/references'

export const VibeTransferPatch = z.object({
    referenceStrength: z.number().min(0).max(1).optional(),
    informationExtracted: z.number().min(0).max(1).optional(),
    enabled: z.boolean().optional(),
})
export type VibeTransferPatch = z.infer<typeof VibeTransferPatch>

export const CharacterReferencePatch = z.object({
    strength: z.number().min(0).max(1).optional(),
    fidelity: z.number().min(0).max(1).optional(),
    mode: CharacterReferenceMode.optional(),
    enabled: z.boolean().optional(),
})
export type CharacterReferencePatch = z.infer<typeof CharacterReferencePatch>
