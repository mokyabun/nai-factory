import { t } from 'elysia'

export const GroupModel = {
    createBody: t.Object({ name: t.String({ minLength: 1 }) }),
    updateBody: t.Object({ name: t.Optional(t.String({ minLength: 1 })) }),
}
export type GroupModel = { [K in keyof typeof GroupModel]: (typeof GroupModel)[K]['static'] }

export const IdParams = t.Object({ id: t.Numeric() })
