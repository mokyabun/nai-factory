import { asc, eq } from 'drizzle-orm'
import { db, projects } from '@/db'

export async function getAll() {
    return await db.select().from(projects)
}

export async function getById(id: number) {
    const [project] = await db.select().from(projects).where(eq(projects.id, id))

    return project ?? null
}

export async function getAllByGroupId(groupId: number) {
    return await db
        .select()
        .from(projects)
        .where(eq(projects.groupId, groupId))
        .orderBy(asc(projects.name))
}
