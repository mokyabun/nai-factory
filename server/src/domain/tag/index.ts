import { Elysia, t } from 'elysia'
import * as service from './service'

export const tag = new Elysia({ prefix: '/tags' }).get(
    '/autocomplete',
    ({ query }) => service.search(query.q, query.limit ?? 20),
    {
        query: t.Object({
            q: t.String({ minLength: 1 }),
            limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 20 })),
        }),
    },
)
