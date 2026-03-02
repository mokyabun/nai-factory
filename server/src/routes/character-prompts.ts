import { eq } from 'drizzle-orm'
import { Elysia, status, t } from 'elysia'
import { db } from '@/db'
import { projects } from '@/db/schema'
import type { CharacterPrompt } from '@/types'

const CharacterPromptModel = {
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

    reorderBody: t.Object({
        fromIndex: t.Number(),
        toIndex: t.Number(),
    }),
}

async function getProject(projectId: number) {
    const [proj] = await db.select().from(projects).where(eq(projects.id, projectId))
    if (!proj) throw status(404, 'Project not found')
    return proj
}

async function get(projectId: number) {
    const proj = await getProject(projectId)
    return proj.characterPrompts ?? []
}

async function create(
    projectId: number,
    body: { enabled?: boolean; center?: { x: number; y: number }; prompt?: string; uc?: string },
) {
    const proj = await getProject(projectId)

    const newItem: CharacterPrompt = {
        enabled: body.enabled ?? true,
        center: body.center ?? { x: 0.5, y: 0.5 },
        prompt: body.prompt ?? '',
        uc: body.uc ?? '',
    }

    const updated = [...(proj.characterPrompts ?? []), newItem]

    const [result] = await db
        .update(projects)
        .set({
            characterPrompts: JSON.stringify(updated) as unknown as typeof proj.characterPrompts,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(projects.id, projectId))
        .returning()

    return result!.characterPrompts
}

async function update(
    projectId: number,
    index: number,
    body: { enabled?: boolean; center?: { x: number; y: number }; prompt?: string; uc?: string },
) {
    const proj = await getProject(projectId)
    const list = [...(proj.characterPrompts ?? [])]

    if (index < 0 || index >= list.length) throw status(404, 'Character prompt not found')

    list[index] = { ...list[index]!, ...body } as CharacterPrompt

    const [result] = await db
        .update(projects)
        .set({
            characterPrompts: JSON.stringify(list) as unknown as typeof proj.characterPrompts,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(projects.id, projectId))
        .returning()

    return result!.characterPrompts
}

async function reorder(projectId: number, fromIndex: number, toIndex: number) {
    const proj = await getProject(projectId)
    const list = [...(proj.characterPrompts ?? [])]

    if (fromIndex < 0 || fromIndex >= list.length) throw status(404, 'Character prompt not found')
    if (toIndex < 0 || toIndex >= list.length) throw status(400, 'Invalid target index')

    const item = list.splice(fromIndex, 1)[0]!
    list.splice(toIndex, 0, item)

    const [result] = await db
        .update(projects)
        .set({
            characterPrompts: JSON.stringify(list) as unknown as typeof proj.characterPrompts,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(projects.id, projectId))
        .returning()

    return result!.characterPrompts
}

async function remove(projectId: number, index: number) {
    const proj = await getProject(projectId)
    const list = [...(proj.characterPrompts ?? [])]

    if (index < 0 || index >= list.length) throw status(404, 'Character prompt not found')

    list.splice(index, 1)

    await db
        .update(projects)
        .set({
            characterPrompts: JSON.stringify(list) as unknown as typeof proj.characterPrompts,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(projects.id, projectId))

    return { success: true }
}

export const characterPrompt = new Elysia({ prefix: '/character-prompts' })
    .get('/:projectId', ({ params }) => get(params.projectId), {
        params: CharacterPromptModel.projectParams,
    })
    .post('/:projectId', ({ params, body }) => create(params.projectId, body), {
        params: CharacterPromptModel.projectParams,
        body: CharacterPromptModel.createBody,
    })
    .patch(
        '/:projectId/reorder',
        ({ params, body }) => reorder(params.projectId, body.fromIndex, body.toIndex),
        {
            params: CharacterPromptModel.projectParams,
            body: CharacterPromptModel.reorderBody,
        },
    )
    .patch(
        '/:projectId/:index',
        ({ params, body }) => update(params.projectId, params.index, body),
        {
            params: CharacterPromptModel.itemParams,
            body: CharacterPromptModel.updateBody,
        },
    )
    .delete('/:projectId/:index', ({ params }) => remove(params.projectId, params.index), {
        params: CharacterPromptModel.itemParams,
    })
