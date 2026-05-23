import type * as z from 'zod'

export type InferSchemas<T extends Record<string, z.ZodType>> = {
    [K in keyof T]: z.infer<T[K]>
}
