import { asc, eq } from 'drizzle-orm'
import { db, groups } from '@/db'
import { imageService } from './image'

export async function listGroups() {
    return db.select().from(groups).orderBy(asc(groups.name))
}

export async function getGroupById(id: number) {
    const [group] = await db.select().from(groups).where(eq(groups.id, id))
    return group ?? null
}

export async function createGroup(name: string) {
    const [created] = await db.insert(groups).values({ name }).returning()
    return created!
}

export async function updateGroup(id: number, data: { name?: string }) {
    const [updated] = await db
        .update(groups)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(groups.id, id))
        .returning()
    return updated ?? null
}

export async function deleteGroup(id: number) {
    const [group] = await db.select().from(groups).where(eq(groups.id, id))
    if (!group) return false

    await db.delete(groups).where(eq(groups.id, id))
    await imageService.deleteByGroup(id)

    return true
}
