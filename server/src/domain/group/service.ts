import type { GroupModel } from '@nai-factory/shared'
import { eq } from 'drizzle-orm'
import { db, groups } from '@/db'
import { imageService } from '@/services/image'

export async function getAll() {
    return db.select().from(groups).orderBy(groups.name)
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
        .set({
            ...data,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(groups.id, id))
        .returning()

    return updated ?? null
}

export async function remove(id: number) {
    const [existing] = await db.select().from(groups).where(eq(groups.id, id))
    if (!existing) return false

    // TODO: Consider using Promise.all but it might cause issue
    await db.delete(groups).where(eq(groups.id, id))
    await imageService.deleteByGroup(id)

    return true
}
