import * as z from 'zod'

export const IdParams = z.object({ id: z.coerce.number() })
export const ProjectIdParams = z.object({ projectId: z.coerce.number() })

export type IdParams = z.infer<typeof IdParams>
export type ProjectIdParams = z.infer<typeof ProjectIdParams>
