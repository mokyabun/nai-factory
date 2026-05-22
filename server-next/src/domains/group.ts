import { zValidator } from '@hono/zod-validator'
import { GroupModel, IdParams } from '@nai-factory/types'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db, groups } from '#/db'

async function getAll() {
    return db.select().from(groups).orderBy(groups.name)
}

async function getById(id: number) {
    const [group] = await db.select().from(groups).where(eq(groups.id, id))

    return group ?? null
}

async function create(data: GroupModel['createBody']) {
    const [created] = await db.insert(groups).values(data).returning()

    return created ?? null
}

async function update(id: number, data: GroupModel['updateBody']) {
    const [updated] = await db.update(groups).set(data).where(eq(groups.id, id)).returning()

    return updated ?? null
}

async function remove(id: number) {
    const [existing] = await db.select().from(groups).where(eq(groups.id, id))
    if (!existing) return false

    await db.delete(groups).where(eq(groups.id, id))
    return true
}

export { create, getAll, getById, remove, update }

export const group = new Hono()
    .get('/', async (c) => {
        const groups = await getAll()

        return c.json(groups)
    })
    .get('/:id', zValidator('param', IdParams), async (c) => {
        const id = c.req.valid('param').id
        const group = await getById(id)
        if (!group) return c.text('Group not found', 404)

        return c.json(group)
    })
    .post('/', zValidator('json', GroupModel.createBody), async (c) => {
        const body = c.req.valid('json')
        if (!body.name || typeof body.name !== 'string') {
            return c.text('Name is required and must be a string', 400)
        }

        const created = await create({ name: body.name })
        if (!created) return c.text('Failed to create group', 500)

        return c.json(created, 201)
    })
    .patch(
        '/:id',
        zValidator('param', IdParams),
        zValidator('json', GroupModel.updateBody),
        async (c) => {
            const id = c.req.valid('param').id

            const body = c.req.valid('json')
            if (body.name !== undefined && typeof body.name !== 'string') {
                return c.text('Name must be a string', 400)
            }

            const updated = await update(id, { name: body.name })
            if (!updated) return c.text('Group not found', 404)

            return c.json(updated)
        },
    )
    .delete('/:id', zValidator('param', IdParams), async (c) => {
        const id = c.req.valid('param').id

        const success = await remove(id)
        if (!success) return c.text('Group not found', 404)

        return c.status(204)
    })
