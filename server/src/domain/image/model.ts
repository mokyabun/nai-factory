import { t } from 'elysia'

export const ImageModel = {
    getParams: t.Object({ sceneId: t.Numeric() }),
    reorderBody: t.Object({ prevId: t.Nullable(t.Number()), nextId: t.Nullable(t.Number()) }),
}

export const IdParams = t.Object({ id: t.Numeric() })
