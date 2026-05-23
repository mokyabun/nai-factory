import { zValidator } from '@hono/zod-validator'
import {
    CreateProjectBody,
    ProjectIdParams,
    ProjectListQuery,
    UpdateProjectBody,
} from '@nai-factory/types'
import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { db, projects, scenes } from '#/db'
import { removeByProject } from '#/services'
import { nextDisplayOrder, withUpdatedAt } from '#/shared'

async function getById(id: number) {
    const [project] = await db.select().from(projects).where(eq(projects.id, id))
    return project ?? null
}

async function getAllByGroupId(groupId: number) {
    return db
        .select()
        .from(projects)
        .where(eq(projects.groupId, groupId))
        .orderBy(asc(projects.name))
}

async function create(data: CreateProjectBody) {
    const [created] = await db.insert(projects).values(data).returning()
    return created ?? null
}

async function update(id: number, data: UpdateProjectBody) {
    const [updated] = await db
        .update(projects)
        .set(withUpdatedAt(data))
        .where(eq(projects.id, id))
        .returning()

    return updated ?? null
}

async function remove(id: number) {
    const [existing] = await db.select().from(projects).where(eq(projects.id, id))
    if (!existing) return false

    await db.delete(projects).where(eq(projects.id, id))
    await removeByProject(id)

    return true
}

async function duplicate(id: number) {
    const [existing] = await db.select().from(projects).where(eq(projects.id, id))
    if (!existing) return null

    const { id: _projectId, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = existing
    const [created] = await db
        .insert(projects)
        .values({ ...rest, name: `${existing.name} (copy)` })
        .returning()
    if (!created) return null

    const projectScenes = await db
        .select()
        .from(scenes)
        .where(eq(scenes.projectId, id))
        .orderBy(asc(scenes.displayOrder), asc(scenes.id))

    let previousOrder: string | null = null
    for (const scene of projectScenes) {
        const {
            id: _sceneId,
            createdAt: _sceneCreatedAt,
            updatedAt: _sceneUpdatedAt,
            ...sceneRest
        } = scene
        const displayOrder = nextDisplayOrder(previousOrder)
        await db.insert(scenes).values({ ...sceneRest, projectId: created.id, displayOrder })
        previousOrder = displayOrder
    }

    return created
}

export const project = new Hono()
    .get('/', zValidator('query', ProjectListQuery), async (c) =>
        c.json(await getAllByGroupId(c.req.valid('query').groupId)),
    )
    .get('/:projectId', zValidator('param', ProjectIdParams), async (c) => {
        const result = await getById(c.req.valid('param').projectId)
        if (!result) throw new HTTPException(404, { message: 'Project not found' })
        return c.json(result)
    })
    .post('/', zValidator('json', CreateProjectBody), async (c) => {
        const result = await create(c.req.valid('json'))
        if (!result) throw new HTTPException(500, { message: 'Failed to create project' })
        return c.json(result)
    })
    .patch(
        '/:projectId',
        zValidator('param', ProjectIdParams),
        zValidator('json', UpdateProjectBody),
        async (c) => {
            const result = await update(c.req.valid('param').projectId, c.req.valid('json'))
            if (!result) throw new HTTPException(404, { message: 'Project not found' })
            return c.json(result)
        },
    )
    .delete('/:projectId', zValidator('param', ProjectIdParams), async (c) => {
        const success = await remove(c.req.valid('param').projectId)
        if (!success) throw new HTTPException(404, { message: 'Project not found' })
        return c.body(null, 204)
    })
    .post('/:projectId/duplicate', zValidator('param', ProjectIdParams), async (c) => {
        const result = await duplicate(c.req.valid('param').projectId)
        if (!result) throw new HTTPException(404, { message: 'Project not found' })
        return c.json(result)
    })
