import * as z from 'zod'

export const GroupCreateBody = z.object({
    parentId: z.number().int().positive().nullable().optional(),
    name: z.string().trim().min(1),
})
export type GroupCreateBody = z.infer<typeof GroupCreateBody>

export const GroupPatch = z.object({
    parentId: z.number().int().positive().nullable().optional(),
    name: z.string().trim().min(1).optional(),
})
export type GroupPatch = z.infer<typeof GroupPatch>
