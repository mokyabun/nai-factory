import { asc, desc, eq } from 'drizzle-orm'
import { generateKeyBetween } from 'fractional-indexing-jittered'
import { db, variations } from '@/db'
import type { PromptVariable } from '@/types'

export async function listByScene(sceneId: number) {
    return db
        .select()
        .from(variations)
        .where(eq(variations.sceneId, sceneId))
        .orderBy(asc(variations.displayOrder), asc(variations.id))
}

export async function getById(id: number) {
    const [row] = await db.select().from(variations).where(eq(variations.id, id))
    return row ?? null
}

export async function create(sceneId: number, variables: PromptVariable = {}) {
    const [last] = await db
        .select({ displayOrder: variations.displayOrder })
        .from(variations)
        .where(eq(variations.sceneId, sceneId))
        .orderBy(desc(variations.displayOrder))
        .limit(1)

    const displayOrder = generateKeyBetween(last?.displayOrder ?? null, null)

    const [created] = await db
        .insert(variations)
        .values({ sceneId, displayOrder, variables })
        .returning()

    return created!
}

export async function update(id: number, variables: PromptVariable) {
    const [updated] = await db
        .update(variations)
        .set({ variables })
        .where(eq(variations.id, id))
        .returning()

    return updated ?? null
}

export async function reorder(id: number, prevId: number | null, nextId: number | null) {
    let prevOrder: string | null = null
    let nextOrder: string | null = null

    if (prevId) {
        const [prev] = await db
            .select({ displayOrder: variations.displayOrder })
            .from(variations)
            .where(eq(variations.id, prevId))
        prevOrder = prev?.displayOrder ?? null
    }

    if (nextId) {
        const [next] = await db
            .select({ displayOrder: variations.displayOrder })
            .from(variations)
            .where(eq(variations.id, nextId))
        nextOrder = next?.displayOrder ?? null
    }

    const displayOrder = generateKeyBetween(prevOrder, nextOrder)

    const [updated] = await db
        .update(variations)
        .set({ displayOrder })
        .where(eq(variations.id, id))
        .returning()

    return updated ?? null
}

export async function remove(id: number) {
    const [existing] = await db.select().from(variations).where(eq(variations.id, id))
    if (!existing) return false

    await db.delete(variations).where(eq(variations.id, id))
    return true
}
