import * as z from 'zod'

export const Tag = z.object({
    id: z.number(),

    alias: z.string(),
    tag: z.string(),

    category: z.number(),
    priority: z.number(),
})

export const TagAutocompleteGetQuery = z.object({
    q: z.string().min(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const TagAutocompleteQuery = TagAutocompleteGetQuery

export type Tag = z.infer<typeof Tag>
export type TagAutocompleteGetQuery = z.infer<typeof TagAutocompleteGetQuery>
export type TagAutocompleteQuery = TagAutocompleteGetQuery
