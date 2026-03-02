import { asc, eq, sql } from 'drizzle-orm'
import { Elysia, status, t } from 'elysia'
import { db } from '@/db'
import { groups, projects } from '@/db/schema'

const GroupModel = {
    getParams: t.Object({ id: t.Numeric() }),

    createBody: t.Object({ name: t.String({ minLength: 1 }) }),

    updateParams: t.Object({ id: t.Numeric() }),
    updateBody: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
    }),
}

async function get() {
    const rows = await db.select().from(groups).orderBy(asc(groups.name))

    return rows
}

async function getById(id: number) {
    const [group] = await db.select().from(groups).where(eq(groups.id, id))

    if (!group) throw status(404, 'Group not found')

    const groupProjects = await db
        .select()
        .from(projects)
        .where(eq(projects.groupId, id))
        .orderBy(asc(projects.displayOrder), asc(projects.id))

    return { ...group, projects: groupProjects }
}

async function create(name: string) {
    const [created] = await db.insert(groups).values({ name }).returning()
    return created
}

async function update(id: number, body: { name?: string }) {
    const [existing] = await db.select().from(groups).where(eq(groups.id, id))

    if (!existing) throw status(404, 'Group not found')

    const [updated] = await db
        .update(groups)
        .set({ ...body, updatedAt: new Date().toISOString() })
        .where(eq(groups.id, id))
        .returning()

    return updated
}

async function remove(id: number) {
    const [existing] = await db.select().from(groups).where(eq(groups.id, id))

    if (!existing) throw status(404, 'Group not found')

    await db.delete(groups).where(eq(groups.id, id))

    return status(204)
}

export const group = new Elysia({ prefix: '/groups' })
    .get('/', () => get())
    .get('/:id', ({ params }) => getById(params.id), { params: GroupModel.getParams })
    .post('/', ({ body }) => create(body.name), { body: GroupModel.createBody })
    .patch('/:id', ({ params, body }) => update(params.id, body), {
        params: GroupModel.updateParams,
        body: GroupModel.updateBody,
    })
    .delete('/:id', ({ params }) => remove(params.id), { params: GroupModel.getParams })
