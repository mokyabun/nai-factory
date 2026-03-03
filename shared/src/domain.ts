import { t } from 'elysia'
import { CharacterPrompt, Parameters } from './app'

type InferModel<T extends Record<string, { static: unknown }>> = {
    [K in keyof T]: T[K]['static']
}

// Shared domain models
export const IdParams = t.Object({ id: t.Numeric() })

export type GroupModel = InferModel<typeof GroupModel>
export const GroupModel = {
    createBody: t.Object({ name: t.String({ minLength: 1 }) }),
    updateBody: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
    }),
}

export type ProjectModel = InferModel<typeof ProjectModel>
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

export const VibeTransferModel = {}
