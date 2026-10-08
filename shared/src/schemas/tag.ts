import * as z from 'zod'

export const Tag = z.object({
    id: z.number(),
    alias: z.string(),
    tag: z.string(),
    category: z.number(),
    priority: z.number(),
})
export type Tag = z.infer<typeof Tag>
