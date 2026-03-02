import { asc, desc, eq, inArray } from 'drizzle-orm'
import { Elysia, status, t } from 'elysia'
import { generateKeyBetween } from 'fractional-indexing-jittered'
import { db } from '@/db'
import { groups, images, projects, scenes } from '@/db/schema'
import type { Parameters, PromptVariable } from '@/types'

const ParametersSchema = t.Partial(
    t.Object({
        width: t.Number(),
        height: t.Number(),
        steps: t.Number(),
        promptGuidance: t.Number(),
        varietyPlus: t.Boolean(),
        seed: t.Number(),
        sampler: t.Union([
            t.Literal('k_euler_ancestral'),
            t.Literal('k_euler'),
            t.Literal('k_dpmpp_2s_ancestral'),
            t.Literal('k_dpmpp_2m'),
            t.Literal('k_dpmpp_sde'),
            t.Literal('k_dpmpp_2m_sde'),
            t.Literal('dimm_v3'),
        ]),
        promptGuidanceRescale: t.Number(),
        noiseSchedule: t.Union([
            t.Literal('native'),
            t.Literal('karras'),
            t.Literal('exponential'),
            t.Literal('polyexponential'),
        ]),
        normalizeReferenceStrengthValues: t.Boolean(),
        useCharacterPositions: t.Boolean(),
    }),
)

const ProjectModel = {
    getParams: t.Object({ id: t.Numeric() }),

    createBody: t.Object({
        groupId: t.Number(),
        name: t.String({ minLength: 1 }),
    }),

    updateParams: t.Object({ id: t.Numeric() }),
    updateBody: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        prompt: t.Optional(t.String()),
        negativePrompt: t.Optional(t.String()),
        parameters: t.Optional(ParametersSchema),
        variables: t.Optional(t.Record(t.String(), t.String())),
    }),

    reorderBody: t.Object({
        prevId: t.Nullable(t.Number()),
        nextId: t.Nullable(t.Number()),
    }),
}

async function get(groupId?: number) {
    const rows = groupId
        ? await db
              .select()
              .from(projects)
              .where(eq(projects.groupId, groupId))
              .orderBy(asc(projects.displayOrder), asc(projects.id))
        : await db.select().from(projects).orderBy(asc(projects.displayOrder), asc(projects.id))

    return rows
}

async function getById(id: number) {
    const [project] = await db.select().from(projects).where(eq(projects.id, id))

    if (!project) throw status(404, 'Project not found')

    return project
}

export async function getWorkspaceData(projectId: number) {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId))

    if (!project) throw new Error(`Project ${projectId} not found`)

    const projectScenes = await db
        .select()
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(asc(scenes.displayOrder), asc(scenes.id))

    const sceneIds = projectScenes.map((s) => s.id)

    const recentImages =
        sceneIds.length > 0
            ? await db
                  .select()
                  .from(images)
                  .where(inArray(images.sceneId, sceneIds))
                  .orderBy(desc(images.displayOrder))
                  .limit(60)
            : []

    const imagesByScene = new Map<number, typeof recentImages>()
    for (const img of recentImages) {
        const arr = imagesByScene.get(img.sceneId) ?? []
        arr.push(img)
        imagesByScene.set(img.sceneId, arr)
    }

    const scenesWithData = projectScenes.map((s) => ({
        ...s,
        images: imagesByScene.get(s.id) ?? [],
    }))

    return {
        project,
        scenes: scenesWithData,
    }
}

async function create(groupId: number, name: string) {
    const [group] = await db.select().from(groups).where(eq(groups.id, groupId))

    if (!group) throw status(404, 'Group not found')

    const [last] = await db
        .select({ displayOrder: projects.displayOrder })
        .from(projects)
        .where(eq(projects.groupId, groupId))
        .orderBy(desc(projects.displayOrder))
        .limit(1)

    const displayOrder = generateKeyBetween(last?.displayOrder ?? null, null)

    const [created] = await db.insert(projects).values({ groupId, name, displayOrder }).returning()

    return created
}

async function update(
    id: number,
    body: {
        name?: string
        prompt?: string
        negativePrompt?: string
        parameters?: Partial<Parameters>
        variables?: PromptVariable
    },
) {
    const [existing] = await db.select().from(projects).where(eq(projects.id, id))

    if (!existing) throw status(404, 'Project not found')

    const { parameters, variables, ...rest } = body

    const [updated] = await db
        .update(projects)
        .set({
            ...rest,
            ...(parameters !== undefined && {
                parameters: { ...existing.parameters, ...parameters } as Parameters,
            }),
            ...(variables !== undefined && {
                variables: { ...existing.variables, ...variables },
            }),
            updatedAt: new Date().toISOString(),
        })
        .where(eq(projects.id, id))
        .returning()

    return updated
}

async function reorder(id: number, prevId: number | null, nextId: number | null) {
    const [existing] = await db.select().from(projects).where(eq(projects.id, id))

    if (!existing) throw status(404, 'Project not found')

    let prevDisplayOrder: string | null = null
    let nextDisplayOrder: string | null = null

    if (prevId) {
        const [prev] = await db
            .select({ displayOrder: projects.displayOrder })
            .from(projects)
            .where(eq(projects.id, prevId))

        if (!prev) throw status(404, 'Previous project not found')
        prevDisplayOrder = prev.displayOrder
    }

    if (nextId) {
        const [next] = await db
            .select({ displayOrder: projects.displayOrder })
            .from(projects)
            .where(eq(projects.id, nextId))

        if (!next) throw status(404, 'Next project not found')
        nextDisplayOrder = next.displayOrder
    }

    const displayOrder = generateKeyBetween(prevDisplayOrder, nextDisplayOrder)

    const [updated] = await db
        .update(projects)
        .set({ displayOrder, updatedAt: new Date().toISOString() })
        .where(eq(projects.id, id))
        .returning()

    return updated
}

async function remove(id: number) {
    const [existing] = await db.select().from(projects).where(eq(projects.id, id))

    if (!existing) throw status(404, 'Project not found')

    await db.delete(projects).where(eq(projects.id, id))
    return { success: true }
}

export const project = new Elysia({ prefix: '/projects' })
    .get('/', ({ query }) => get(query.groupId), {
        query: t.Object({ groupId: t.Optional(t.Numeric()) }),
    })
    .get('/:id', ({ params }) => getById(params.id), { params: ProjectModel.getParams })
    .get(
        '/:id/workspace',
        async ({ params }) => {
            const id = Number(params.id)
            const [p] = await db.select().from(projects).where(eq(projects.id, id))
            if (!p) throw status(404, 'Project not found')
            return getWorkspaceData(id)
        },
        { params: ProjectModel.getParams },
    )
    .post('/', ({ body }) => create(body.groupId, body.name), { body: ProjectModel.createBody })
    .patch('/:id', ({ params, body }) => update(params.id, body), {
        params: ProjectModel.updateParams,
        body: ProjectModel.updateBody,
    })
    .patch('/:id/order', ({ params, body }) => reorder(params.id, body.prevId, body.nextId), {
        params: ProjectModel.updateParams,
        body: ProjectModel.reorderBody,
    })
    .delete('/:id', ({ params }) => remove(params.id), { params: ProjectModel.getParams })
