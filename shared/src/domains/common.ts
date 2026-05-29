import * as z from 'zod'

export const IdParams = z.object({
    id: z.coerce.number().int().positive(),
})

export const ProjectIdParams = z.object({
    projectId: z.coerce.number().int().positive(),
})

export const OptionalOrderBody = z.object({
    prevId: z.number().int().positive().nullable(),
    nextId: z.number().int().positive().nullable(),
})

export type IdParams = z.infer<typeof IdParams>
export type ProjectIdParams = z.infer<typeof ProjectIdParams>
export type OptionalOrderBody = z.infer<typeof OptionalOrderBody>
