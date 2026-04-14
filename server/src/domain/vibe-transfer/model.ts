import { t } from 'elysia'

export const VibeTransferModel = {
    projectParams: t.Object({ projectId: t.Numeric() }),
    itemParams: t.Object({ projectId: t.Numeric(), id: t.Numeric() }),

    uploadBody: t.Object({
        image: t.File({ type: 'image' }),
    }),

    updateBody: t.Object({
        referenceStrength: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
        informationExtracted: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
    }),

    reorderBody: t.Object({
        id: t.Number(),
        prevId: t.Nullable(t.Number()),
        nextId: t.Nullable(t.Number()),
    }),
}
