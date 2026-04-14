import { t } from 'elysia'
import { CharacterPrompt, Parameters } from '@/types'

export const ProjectModel = {
    createBody: t.Object({
        groupId: t.Nullable(t.Numeric()),
        name: t.String({ minLength: 1 }),
    }),
    updateBody: t.Object({
        groupId: t.Optional(t.Nullable(t.Numeric())),
        name: t.Optional(t.String({ minLength: 1 })),
        prompt: t.Optional(t.String()),
        negativePrompt: t.Optional(t.String()),
        parameters: t.Optional(Parameters),
        variables: t.Optional(t.Record(t.String(), t.String())),
        characterPrompts: t.Optional(t.Array(CharacterPrompt)),
    }),
}
export type ProjectModel = { [K in keyof typeof ProjectModel]: (typeof ProjectModel)[K]['static'] }

export const IdParams = t.Object({ projectId: t.Numeric() })
