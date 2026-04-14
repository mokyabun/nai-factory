import { t } from 'elysia'

export const CharacterPromptModel = {
    projectParams: t.Object({ projectId: t.Numeric() }),
    itemParams: t.Object({ projectId: t.Numeric(), index: t.Numeric() }),

    createBody: t.Object({
        enabled: t.Optional(t.Boolean()),
        center: t.Optional(t.Object({ x: t.Number(), y: t.Number() })),
        prompt: t.Optional(t.String()),
        uc: t.Optional(t.String()),
    }),

    updateBody: t.Object({
        enabled: t.Optional(t.Boolean()),
        center: t.Optional(t.Object({ x: t.Number(), y: t.Number() })),
        prompt: t.Optional(t.String()),
        uc: t.Optional(t.String()),
    }),
}
