import { t } from 'elysia'

export const SdStudioModel = {
    importBody: t.Object({
        projectId: t.Number(),
        data: t.Any(),
    }),
}
