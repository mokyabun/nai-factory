import { zValidator } from '@hono/zod-validator'
<<<<<<< HEAD
import { GroupPatchBody, GroupPostBody, IdParams } from '@nai-factory/types'
=======
import { CreateGroupBody, IdParams, UpdateGroupBody } from '@nai-factory/types'
>>>>>>> refs/remotes/origin/main
import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { db, groups, projects } from '#/db'
import { removeByProject } from '#/services'
import { withUpdatedAt } from '#/shared'

<<<<<<< HEAD
async function getAll() {
    return db.select().from(groups).orderBy(asc(groups.name))
=======
async function getAllWithProjects() {
    const [allGroups, allProjects] = await Promise.all([
        db.select().from(groups).orderBy(groups.name),
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
>>>>>>> refs/remotes/origin/main
}

async function getById(id: number) {
    const [group] = await db.select().from(groups).where(eq(groups.id, id))
    return group ?? null
}

<<<<<<< HEAD
async function create(data: GroupPostBody) {
=======
async function create(data: CreateGroupBody) {
>>>>>>> refs/remotes/origin/main
    const [created] = await db.insert(groups).values(data).returning()
    return created ?? null
}

<<<<<<< HEAD
async function update(id: number, data: GroupPatchBody) {
    const [updated] = await db.update(groups).set(data).where(eq(groups.id, id)).returning()
=======
async function update(id: number, data: UpdateGroupBody) {
    const [updated] = await db
        .update(groups)
        .set(withUpdatedAt(data))
        .where(eq(groups.id, id))
        .returning()
>>>>>>> refs/remotes/origin/main

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
        const grp = await getById(c.req.valid('param').id)
        if (!grp) throw new HTTPException(404, { message: 'Group not found' })

        const childProjects = await db
            .select()
            .from(projects)
            .where(eq(projects.groupId, grp.id))
            .orderBy(asc(projects.name))

        return c.json({ ...grp, projects: childProjects })
    })
<<<<<<< HEAD
    .post('/', zValidator('json', GroupPostBody), async (c) => {
        const body = c.req.valid('json')

        const created = await create({ name: body.name })
        if (!created) return c.text('Failed to create group', 500)

        return c.json(created, 201)
    })
    .patch('/:id', zValidator('param', IdParams), zValidator('json', GroupPatchBody), async (c) => {
        const id = c.req.valid('param').id

        const body = c.req.valid('json')
        const updated = await update(id, body)
        if (!updated) return c.text('Group not found', 404)

        return c.json(updated)
    })
    .delete('/:id', zValidator('param', IdParams), async (c) => {
        const id = c.req.valid('param').id

        const success = await remove(id)
        if (!success) return c.text('Group not found', 404)

=======
    .post('/', zValidator('json', CreateGroupBody), async (c) => {
        const created = await create(c.req.valid('json'))
        if (!created) throw new HTTPException(500, { message: 'Failed to create group' })
        return c.json(created)
    })
    .patch(
        '/:id',
        zValidator('param', IdParams),
        zValidator('json', UpdateGroupBody),
        async (c) => {
            const updated = await update(c.req.valid('param').id, c.req.valid('json'))
            if (!updated) throw new HTTPException(404, { message: 'Group not found' })
            return c.json(updated)
        },
    )
    .delete('/:id', zValidator('param', IdParams), async (c) => {
        const success = await remove(c.req.valid('param').id)
        if (!success) throw new HTTPException(404, { message: 'Group not found' })
>>>>>>> refs/remotes/origin/main
        return c.body(null, 204)
    })
