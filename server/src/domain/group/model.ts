import { t } from 'elysia'

export const IdParams = t.Object({ id: t.Numeric() })
export const CreateBody = t.Object({ name: t.String({ minLength: 1 }) })
export const UpdateParams = t.Object({ id: t.Numeric() })
export const UpdateBody = t.Object({
    name: t.Optional(t.String({ minLength: 1 })),
})
