import { t } from 'elysia'

export const QueueModel = {
    getParams: t.Object({ id: t.Numeric() }),
    listQuery: t.Object({ projectId: t.Optional(t.Numeric()) }),
    clearQuery: t.Object({ sceneId: t.Optional(t.Numeric()) }),

    enqueueBody: t.Object({
        sceneId: t.Number(),
        position: t.Optional(t.Union([t.Literal('back'), t.Literal('front')], { default: 'back' })),
    }),

    enqueueAllBody: t.Object({
        projectId: t.Number(),
        position: t.Optional(t.Union([t.Literal('back'), t.Literal('front')], { default: 'back' })),
    }),

    enqueueBulkBody: t.Object({
        sceneIds: t.Array(t.Number(), { minItems: 1 }),
        position: t.Optional(t.Union([t.Literal('back'), t.Literal('front')], { default: 'back' })),
    }),
}
