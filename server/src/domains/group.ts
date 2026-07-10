import { zValidator } from '@hono/zod-validator'
import {
    type GroupListItem,
    GroupPatchBody,
    GroupPostBody,
    type GroupProjectSummary,
    type GroupWithProjects,
    IdParams,
} from '@nai-factory/shared'
import { asc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { db, groups, projects } from '@/db'
import logger from '@/logger'
import { removeByProject, removeCharacterReferencesByProject } from '@/services'
import { withUpdatedAt } from '@/utils'

const log = logger.child({ module: 'group-domain' })

type GroupRow = typeof groups.$inferSelect

function createGroupNodes(allGroups: GroupRow[]) {
    return new Map<number, GroupWithProjects>(
        allGroups.map((group) => [
            group.id,
            {
                ...group,
                type: 'group' as const,
                projects: [],
                groups: [],
            },
        ]),
    )
}

function attachGroups(nodes: Map<number, GroupWithProjects>) {
    const rootGroups: GroupWithProjects[] = []

    for (const group of nodes.values()) {
        if (group.parentGroupId === null) {
            rootGroups.push(group)
            continue
        }

        const parent = nodes.get(group.parentGroupId)
        if (parent) parent.groups.push(group)
        else rootGroups.push(group)
    }

    return rootGroups
}

function attachProjects(nodes: Map<number, GroupWithProjects>, allProjects: GroupProjectSummary[]) {
    const ungroupedProjects: GroupProjectSummary[] = []

    for (const project of allProjects) {
        if (project.groupId === null) {
            ungroupedProjects.push(project)
            continue
        }

        nodes.get(project.groupId)?.projects.push(project)
    }

    return ungroupedProjects
}

function buildGroupTree(allGroups: GroupRow[], allProjects: GroupProjectSummary[]) {
    const nodes = createGroupNodes(allGroups)
    const rootGroups = attachGroups(nodes)
    const ungroupedProjects = attachProjects(nodes, allProjects)

    return { nodes, rootGroups, ungroupedProjects }
}

async function getAllWithProjects() {
    const [allGroups, allProjects] = await Promise.all([
        db.select().from(groups).orderBy(asc(groups.name), asc(groups.id)),
        db
            .select({ id: projects.id, groupId: projects.groupId, name: projects.name })
            .from(projects)
            .orderBy(asc(projects.name), asc(projects.id)),
    ])

    const { rootGroups, ungroupedProjects } = buildGroupTree(allGroups, allProjects)

    if (ungroupedProjects.length === 0) return rootGroups satisfies GroupListItem[]

    return [
        {
            type: 'ungrouped',
            id: null,
            name: '그룹 없음',
            projects: ungroupedProjects,
        },
        ...rootGroups,
    ]
}

async function getById(id: number) {
    const [group] = await db.select().from(groups).where(eq(groups.id, id))
    return group ?? null
}

async function assertValidParent(id: number | null, parentGroupId: number | null | undefined) {
    if (parentGroupId === undefined || parentGroupId === null) return
    if (id !== null && parentGroupId === id) {
        throw new HTTPException(400, { message: 'A group cannot be its own parent' })
    }

    const allGroups = await db.select().from(groups)
    if (!allGroups.some((group) => group.id === parentGroupId)) {
        throw new HTTPException(400, { message: 'Parent group not found' })
    }

    if (id === null) return

    const descendants = getDescendantGroupIds(allGroups, id)
    if (descendants.includes(parentGroupId)) {
        throw new HTTPException(400, { message: 'A group cannot be moved below its descendant' })
    }
}

function getDescendantGroupIds(allGroups: GroupRow[], rootGroupId: number) {
    const childrenByParent = new Map<number, number[]>()
    for (const group of allGroups) {
        if (group.parentGroupId === null) continue
        const children = childrenByParent.get(group.parentGroupId) ?? []
        children.push(group.id)
        childrenByParent.set(group.parentGroupId, children)
    }

    const result: number[] = []
    const stack = [...(childrenByParent.get(rootGroupId) ?? [])]
    const visited = new Set<number>()
    while (stack.length > 0) {
        const groupId = stack.pop()
        if (groupId === undefined || visited.has(groupId)) continue
        visited.add(groupId)
        result.push(groupId)
        stack.push(...(childrenByParent.get(groupId) ?? []))
    }

    return result
}

async function create(data: GroupPostBody) {
    await assertValidParent(null, data.parentGroupId)
    const [created] = await db.insert(groups).values(data).returning()
    if (created) log.debug({ groupId: created.id }, 'Group created')
    return created ?? null
}

async function update(id: number, data: GroupPatchBody) {
    await assertValidParent(id, data.parentGroupId)
    const [updated] = await db
        .update(groups)
        .set(withUpdatedAt(data))
        .where(eq(groups.id, id))
        .returning()

    if (updated) log.debug({ groupId: id, fields: Object.keys(data) }, 'Group updated')
    return updated ?? null
}

async function remove(id: number) {
    const [existing] = await db.select().from(groups).where(eq(groups.id, id))
    if (!existing) return false

    const allGroups = await db.select().from(groups)
    const groupIds = [id, ...getDescendantGroupIds(allGroups, id)]
    const childProjects = await db
        .select({ id: projects.id })
        .from(projects)
        .where(inArray(projects.groupId, groupIds))

    await Promise.all(
        childProjects.map((project) =>
            Promise.all([
                removeByProject(project.id),
                removeCharacterReferencesByProject(project.id),
            ]),
        ),
    )
    await db.delete(groups).where(eq(groups.id, id))

    log.debug(
        {
            groupId: id,
            childGroupCount: groupIds.length - 1,
            childProjectCount: childProjects.length,
        },
        'Group deleted',
    )
    return true
}

export const group = new Hono()
    .get('/', async (c) => c.json(await getAllWithProjects()))
    .get('/:id', zValidator('param', IdParams), async (c) => {
        const group = await getById(c.req.valid('param').id)
        if (!group) throw new HTTPException(404, { message: 'Group not found' })

        const [allGroups, allProjects] = await Promise.all([
            db.select().from(groups).orderBy(asc(groups.name), asc(groups.id)),
            db
                .select({ id: projects.id, groupId: projects.groupId, name: projects.name })
                .from(projects)
                .orderBy(asc(projects.name), asc(projects.id)),
        ])
        const { nodes } = buildGroupTree(allGroups, allProjects)
        const item = nodes.get(group.id)
        if (!item) throw new HTTPException(404, { message: 'Group not found' })

        return c.json(item)
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
