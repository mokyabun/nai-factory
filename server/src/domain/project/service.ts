import { asc, eq } from 'drizzle-orm'
import type { ProjectModel } from './model'
import { db, projects, scenes } from '@/db'
import * as imageService from '@/services/image'

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
    await imageService.removeByProject(id)

    return true
}

export async function duplicate(id: number) {
    const [existing] = await db.select().from(projects).where(eq(projects.id, id))
    if (!existing) return null

    const { id: _, createdAt: __, updatedAt: ___, ...rest } = existing
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

    for (const scene of projectScenes) {
        const { id: __, createdAt: ___, updatedAt: ____, thumbnailImageId: _____, ...sceneRest } = scene
        await db.insert(scenes).values({ ...sceneRest, projectId: created.id, thumbnailImageId: null })
    }

    return created
}
