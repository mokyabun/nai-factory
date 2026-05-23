import * as z from 'zod'

export const TagAutocompleteQuery = z.object({
    q: z.string().min(1),
    limit: z.coerce.number().min(1).max(100).optional().default(20),
})

export type TagAutocompleteQuery = z.infer<typeof TagAutocompleteQuery>
