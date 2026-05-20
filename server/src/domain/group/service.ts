import { asc, eq } from 'drizzle-orm'
import { db, groups, projects } from '../../db'
import { removeByProject } from '../../services'
import { withUpdatedAt } from '../../shared'
import type { GroupModel } from './model'

export async function getAll() {
    return db.select().from(groups).orderBy(groups.name)
}

export async function getAllWithProjects() {
    const [allGroups, allProjects] = await Promise.all([
        db.select().from(groups).orderBy(groups.name),
        db
            .select({ id: projects.id, groupId: projects.groupId, name: projects.name })
            .from(projects)
            .orderBy(asc(projects.name)),
    ])

    const byGroup = new Map<number, { id: number; name: string }[]>()
    for (const p of allProjects) {
        if (p.groupId === null) continue
        if (!byGroup.has(p.groupId)) byGroup.set(p.groupId, [])
        byGroup.get(p.groupId)!.push({ id: p.id, name: p.name })
    }

    return allGroups.map((g) => ({ ...g, projects: byGroup.get(g.id) ?? [] }))
}

export async function getById(id: number) {
    const [group] = await db.select().from(groups).where(eq(groups.id, id))

    return group ?? null
}

export async function create(data: GroupModel['createBody']) {
    const [created] = await db.insert(groups).values(data).returning()

    return created ?? null
}

export async function update(id: number, data: GroupModel['updateBody']) {
    const [updated] = await db
        .update(groups)
        .set(withUpdatedAt(data))
        .where(eq(groups.id, id))
        .returning()

    return updated ?? null
}

export async function remove(id: number) {
    const [existing] = await db.select().from(groups).where(eq(groups.id, id))
    if (!existing) return false

    const childProjects = await db.select().from(projects).where(eq(projects.groupId, id))

    await db.delete(groups).where(eq(groups.id, id))
    await Promise.all(childProjects.map((project) => removeByProject(project.id)))

    return true
}
