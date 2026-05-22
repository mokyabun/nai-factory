import * as z from 'zod'

type ModelToType<T> = {
    [K in keyof T]: T[K] extends z.ZodObject<infer S> ? z.infer<T[K]> : never
}

export const IdParams = z.object({ id: z.number() })

export const GroupModel = {
    createBody: z.object({ name: z.string().min(1) }),
    updateBody: z.object({ name: z.string().min(1).optional() }),
}
export type GroupModel = ModelToType<typeof GroupModel>
