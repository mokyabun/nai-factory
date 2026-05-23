import * as z from 'zod'

export const Group = z.object({
    id: z.number(),

    name: z.string(),

    createdAt: z.string(),
    updatedAt: z.string(),
})

export const GroupPostBody = z.object({
    name: z.string().min(1),
})

export const GroupPatchBody = z.object({
    name: z.string().min(1).optional(),
})

export const CreateGroupBody = GroupPostBody
export const UpdateGroupBody = GroupPatchBody

export type Group = z.infer<typeof Group>
export type GroupPostBody = z.infer<typeof GroupPostBody>
export type GroupPatchBody = z.infer<typeof GroupPatchBody>
export type CreateGroupBody = GroupPostBody
export type UpdateGroupBody = GroupPatchBody
