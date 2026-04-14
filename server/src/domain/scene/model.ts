import { t } from 'elysia'

export const SceneModel = {
    listQuery: t.Object({ projectId: t.Numeric() }),
    getParams: t.Object({ id: t.Numeric() }),

    createBody: t.Object({
        projectId: t.Number(),
        name: t.String({ minLength: 1 }),
    }),

    updateParams: t.Object({ id: t.Numeric() }),
    updateBody: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        variations: t.Optional(t.Array(t.Record(t.String(), t.Any()))),
    }),

    reorderBody: t.Object({
        prevId: t.Nullable(t.Number()),
        nextId: t.Nullable(t.Number()),
    }),

    previewQuery: t.Object({ variationId: t.Optional(t.Numeric()) }),
}
