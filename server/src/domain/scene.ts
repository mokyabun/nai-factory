import { asc, desc, eq, inArray } from 'drizzle-orm'
import { Elysia, status, t } from 'elysia'
import { generateKeyBetween } from 'fractional-indexing-jittered'
import { db } from '@/db'
import { images, projects, scenes } from '@/db/schema'
import { getWorkspaceData } from '@/modules/project'
import { promptService } from '@/services/prompt'

const SceneModel = {
    getParams: t.Object({ id: t.Numeric() }),

    createBody: t.Object({
        projectId: t.Number(),
        name: t.String({ minLength: 1 }),
    }),

    updateParams: t.Object({ id: t.Numeric() }),
    updateBody: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        variables: t.Optional(t.Record(t.String(), t.Any())),
        prompts: t.Optional(t.String()),
        negativePrompts: t.Optional(t.String()),
    }),

    reorderBody: t.Object({
        prevId: t.Nullable(t.Number()),
        nextId: t.Nullable(t.Number()),
    }),
}

async function get(projectId: number) {
    const [proj] = await db.select().from(projects).where(eq(projects.id, projectId))

    if (!proj) throw status(404, 'Project not found')

    const rows = await db
        .select()
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(asc(scenes.displayOrder), asc(scenes.id))

    return rows
}

async function getById(id: number) {
    const [scene] = await db.select().from(scenes).where(eq(scenes.id, id))

    if (!scene) throw status(404, 'Scene not found')

    const sceneImages = await db
        .select()
        .from(images)
        .where(eq(images.sceneId, id))
        .orderBy(desc(images.displayOrder))

    return { ...scene, images: sceneImages }
}

async function create(projectId: number, name: string) {
    const [proj] = await db.select().from(projects).where(eq(projects.id, projectId))

    if (!proj) throw status(404, 'Project not found')

    const [last] = await db
        .select({ displayOrder: scenes.displayOrder })
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(desc(scenes.displayOrder))
        .limit(1)

    const displayOrder = generateKeyBetween(last?.displayOrder ?? null, null)

    const [created] = await db.insert(scenes).values({ projectId, name, displayOrder }).returning()

    return created
}

async function update(
    id: number,
    body: {
        name?: string
        variables?: Record<string, unknown>
        prompts?: string
        negativePrompts?: string
    },
) {
    const [existing] = await db.select().from(scenes).where(eq(scenes.id, id))

    if (!existing) throw status(404, 'Scene not found')

    const { variables, ...rest } = body

    const [updated] = await db
        .update(scenes)
        .set({
            ...rest,
            ...(variables !== undefined && { variables: JSON.stringify(variables) }),
            updatedAt: new Date().toISOString(),
        })
        .where(eq(scenes.id, id))
        .returning()

    return updated
}

async function reorder(id: number, prevId: number | null, nextId: number | null) {
    const [existing] = await db.select().from(scenes).where(eq(scenes.id, id))

    if (!existing) throw status(404, 'Scene not found')

    let prevDisplayOrder: string | null = null
    let nextDisplayOrder: string | null = null

    if (prevId) {
        const [prev] = await db
            .select({ displayOrder: scenes.displayOrder })
            .from(scenes)
            .where(eq(scenes.id, prevId))

        if (!prev) throw status(404, 'Previous scene not found')
        prevDisplayOrder = prev.displayOrder
    }

    if (nextId) {
        const [next] = await db
            .select({ displayOrder: scenes.displayOrder })
            .from(scenes)
            .where(eq(scenes.id, nextId))

        if (!next) throw status(404, 'Next scene not found')
        nextDisplayOrder = next.displayOrder
    }

    const displayOrder = generateKeyBetween(prevDisplayOrder, nextDisplayOrder)

    const [updated] = await db
        .update(scenes)
        .set({ displayOrder, updatedAt: new Date().toISOString() })
        .where(eq(scenes.id, id))
        .returning()

    return updated
}

async function remove(id: number) {
    const [existing] = await db.select().from(scenes).where(eq(scenes.id, id))

    if (!existing) throw status(404, 'Scene not found')

    await db.delete(scenes).where(eq(scenes.id, id))
    return { success: true }
}

export const scene = new Elysia({ prefix: '/scenes' })
    .get('/', ({ query }) => get(query.projectId), { query: t.Object({ projectId: t.Numeric() }) })
    .get('/:id', ({ params }) => getById(params.id), { params: SceneModel.getParams })
    .get(
        '/:id/workspace',
        async ({ params }) => {
            const id = Number(params.id)
            const [s] = await db
                .select({ projectId: scenes.projectId })
                .from(scenes)
                .where(eq(scenes.id, id))
            if (!s) throw status(404, 'Scene not found')
            return getWorkspaceData(s.projectId)
        },
        { params: SceneModel.getParams },
    )
    .get(
        '/:id/preview-prompt',
        async ({ params, query }) => {
            const id = Number(params.id)
            const [s] = await db.select().from(scenes).where(eq(scenes.id, id))
            if (!s) throw status(404, 'Scene not found')
            return promptService.synthesizePrompts(id, query.variationId ?? null)
        },
        {
            params: SceneModel.getParams,
            query: t.Object({ variationId: t.Optional(t.Numeric()) }),
        },
    )
    .post('/', ({ body }) => create(body.projectId, body.name), { body: SceneModel.createBody })
    .patch('/:id', ({ params, body }) => update(params.id, body), {
        params: SceneModel.updateParams,
        body: SceneModel.updateBody,
    })
    .patch('/:id/order', ({ params, body }) => reorder(params.id, body.prevId, body.nextId), {
        params: SceneModel.updateParams,
        body: SceneModel.reorderBody,
    })
    .delete('/:id', ({ params }) => remove(params.id), { params: SceneModel.getParams })
