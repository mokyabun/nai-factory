import * as z from 'zod'

export const Group = z.object({
    id: z.number(),
    name: z.string(),
})

export const CreateGroupBody = z.object({
    name: z.string().min(1),
})

export const UpdateGroupBody = z.object({
    name: z.string().min(1).optional(),
})

export type Group = z.infer<typeof Group>
export type CreateGroupBody = z.infer<typeof CreateGroupBody>
export type UpdateGroupBody = z.infer<typeof UpdateGroupBody>
