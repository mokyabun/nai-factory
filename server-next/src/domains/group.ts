import { zValidator } from '@hono/zod-validator'
import { GroupPatchBody, GroupPostBody, IdParams } from '@nai-factory/types'
import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { db, groups, projects } from '#/db'
import { removeByProject } from '#/services'
import { withUpdatedAt } from '#/shared'

async function getAllWithProjects() {
    const [allGroups, allProjects] = await Promise.all([
        db.select().from(groups).orderBy(asc(groups.name)),
        db
            .select({ id: projects.id, groupId: projects.groupId, name: projects.name })
            .from(projects)
            .orderBy(asc(projects.name)),
    ])

    const byGroup = new Map<number, { id: number; name: string }[]>()
    for (const project of allProjects) {
        if (project.groupId === null) continue
        const collection = byGroup.get(project.groupId) ?? []
        collection.push({ id: project.id, name: project.name })
        byGroup.set(project.groupId, collection)
    }

    return allGroups.map((group) => ({ ...group, projects: byGroup.get(group.id) ?? [] }))
}

async function getById(id: number) {
    const [group] = await db.select().from(groups).where(eq(groups.id, id))
    return group ?? null
}

async function create(data: GroupPostBody) {
    const [created] = await db.insert(groups).values(data).returning()
    return created ?? null
}

async function update(id: number, data: GroupPatchBody) {
    const [updated] = await db
        .update(groups)
        .set(withUpdatedAt(data))
        .where(eq(groups.id, id))
        .returning()

    return updated ?? null
}

async function remove(id: number) {
    const [existing] = await db.select().from(groups).where(eq(groups.id, id))
    if (!existing) return false

    const childProjects = await db.select().from(projects).where(eq(projects.groupId, id))

    await db.delete(groups).where(eq(groups.id, id))
    await Promise.all(childProjects.map((project) => removeByProject(project.id)))

    return true
}

export const group = new Hono()
    .get('/', async (c) => c.json(await getAllWithProjects()))
    .get('/:id', zValidator('param', IdParams), async (c) => {
        const group = await getById(c.req.valid('param').id)
        if (!group) throw new HTTPException(404, { message: 'Group not found' })

        const childProjects = await db
            .select({ id: projects.id, name: projects.name })
            .from(projects)
            .where(eq(projects.groupId, group.id))
            .orderBy(asc(projects.name))

        return c.json({ ...group, projects: childProjects })
    })
    .post('/', zValidator('json', GroupPostBody), async (c) => {
        const created = await create(c.req.valid('json'))
        if (!created) throw new HTTPException(500, { message: 'Failed to create group' })

        return c.json(created, 201)
    })
    .patch('/:id', zValidator('param', IdParams), zValidator('json', GroupPatchBody), async (c) => {
        const updated = await update(c.req.valid('param').id, c.req.valid('json'))
        if (!updated) throw new HTTPException(404, { message: 'Group not found' })

        return c.json(updated)
    })
    .delete('/:id', zValidator('param', IdParams), async (c) => {
        if (!(await remove(c.req.valid('param').id))) {
            throw new HTTPException(404, { message: 'Group not found' })
        }

        return c.body(null, 204)
    })
