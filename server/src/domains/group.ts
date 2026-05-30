import { zValidator } from '@hono/zod-validator'
import {
    type GroupListItem,
    GroupPatchBody,
    GroupPostBody,
    type GroupProjectSummary,
    IdParams,
} from '@nai-factory/shared'
import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { db, groups, projects } from '#/db'
import logger from '#/logger'
import { removeByProject } from '#/services'
import { withUpdatedAt } from '#/shared'

const log = logger.child({ module: 'group-domain' })

async function getAllWithProjects() {
    const [allGroups, allProjects] = await Promise.all([
        db.select().from(groups).orderBy(asc(groups.name)),
        db
            .select({ id: projects.id, groupId: projects.groupId, name: projects.name })
            .from(projects)
            .orderBy(asc(projects.name)),
    ])

    const byGroup = new Map<number, GroupProjectSummary[]>()
    const ungroupedProjects: GroupProjectSummary[] = []
    for (const project of allProjects) {
        if (project.groupId === null) {
            ungroupedProjects.push(project)
            continue
        }
        const collection = byGroup.get(project.groupId) ?? []
        collection.push(project)
        byGroup.set(project.groupId, collection)
    }

    const groupItems: GroupListItem[] = allGroups.map((group) => ({
        ...group,
        type: 'group',
        projects: byGroup.get(group.id) ?? [],
    }))

    if (ungroupedProjects.length === 0) return groupItems

    return [
        {
            type: 'ungrouped',
            id: null,
            name: '그룹 없음',
            projects: ungroupedProjects,
        },
        ...groupItems,
    ]
}

async function getById(id: number) {
    const [group] = await db.select().from(groups).where(eq(groups.id, id))
    return group ?? null
}

async function create(data: GroupPostBody) {
    const [created] = await db.insert(groups).values(data).returning()
    if (created) log.info({ groupId: created.id }, 'Group created')
    return created ?? null
}

async function update(id: number, data: GroupPatchBody) {
    const [updated] = await db
        .update(groups)
        .set(withUpdatedAt(data))
        .where(eq(groups.id, id))
        .returning()

    if (updated) log.info({ groupId: id, fields: Object.keys(data) }, 'Group updated')
    return updated ?? null
}

async function remove(id: number) {
    const [existing] = await db.select().from(groups).where(eq(groups.id, id))
    if (!existing) return false

    const childProjects = await db.select().from(projects).where(eq(projects.groupId, id))

    await db.delete(groups).where(eq(groups.id, id))
    await Promise.all(childProjects.map((project) => removeByProject(project.id)))

    log.warn({ groupId: id, childProjectCount: childProjects.length }, 'Group deleted')
    return true
}

export const group = new Hono()
    .get('/', async (c) => c.json(await getAllWithProjects()))
    .get('/:id', zValidator('param', IdParams), async (c) => {
        const group = await getById(c.req.valid('param').id)
        if (!group) throw new HTTPException(404, { message: 'Group not found' })

        const childProjects = await db
            .select({ id: projects.id, groupId: projects.groupId, name: projects.name })
            .from(projects)
            .where(eq(projects.groupId, group.id))
            .orderBy(asc(projects.name))

        return c.json({ ...group, type: 'group', projects: childProjects })
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
