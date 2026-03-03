import type { ProjectModel } from '@nai-factory/shared'
import { asc, eq } from 'drizzle-orm'
import { db, projects } from '@/db'
import { imageService } from '@/services/image'

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

export async function create(data: ProjectModel['createBody']) {
    const [created] = await db.insert(projects).values(data).returning()

    return created ?? null
}

export async function update(id: number, data: ProjectModel['updateBody']) {
    const [updated] = await db
        .update(projects)
        .set({
            ...data,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(projects.id, id))
        .returning()

    return updated ?? null
}

export async function remove(id: number) {
    const [existing] = await db.select().from(projects).where(eq(projects.id, id))
    if (!existing) return false

    await db.delete(projects).where(eq(projects.id, id))

    return true
}
