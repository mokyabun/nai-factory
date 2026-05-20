import { t } from 'elysia'

export const ImportOptions = t.Object({
    importPrompt: t.Optional(t.Boolean()),
    importNegativePrompt: t.Optional(t.Boolean()),
    importScenes: t.Optional(t.Boolean()),
    importCharacterPrompts: t.Optional(t.Boolean()),
    importParameters: t.Optional(t.Boolean()),
})
export type ImportOptions = typeof ImportOptions.static

export const SdStudioModel = {
    importBody: t.Object({
        projectId: t.Number(),
        data: t.Any(),
        options: t.Optional(ImportOptions),
    }),
}
