import { asc, desc, eq } from 'drizzle-orm'
import { generateKeyBetween } from 'fractional-indexing-jittered'
import { characterPrompts, db } from '@/db'

export async function listByProject(projectId: number) {
    return db
        .select()
        .from(characterPrompts)
        .where(eq(characterPrompts.projectId, projectId))
        .orderBy(asc(characterPrompts.displayOrder), asc(characterPrompts.id))
}

export async function getById(id: number) {
    const [row] = await db.select().from(characterPrompts).where(eq(characterPrompts.id, id))
    return row ?? null
}

export async function create(
    projectId: number,
    data: {
        enabled?: boolean
        centerX?: number
        centerY?: number
        prompt?: string
        uc?: string
    },
) {
    const [last] = await db
        .select({ displayOrder: characterPrompts.displayOrder })
        .from(characterPrompts)
        .where(eq(characterPrompts.projectId, projectId))
        .orderBy(desc(characterPrompts.displayOrder))
        .limit(1)

    const displayOrder = generateKeyBetween(last?.displayOrder ?? null, null)

    const [created] = await db
        .insert(characterPrompts)
        .values({
            projectId,
            displayOrder,
            enabled: data.enabled ?? true,
            centerX: data.centerX ?? 0.5,
            centerY: data.centerY ?? 0.5,
            prompt: data.prompt ?? '',
            uc: data.uc ?? '',
        })
        .returning()

    return created!
}

export async function update(
    id: number,
    data: {
        enabled?: boolean
        centerX?: number
        centerY?: number
        prompt?: string
        uc?: string
    },
) {
    const [updated] = await db
        .update(characterPrompts)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(characterPrompts.id, id))
        .returning()

    return updated ?? null
}

export async function reorder(id: number, prevId: number | null, nextId: number | null) {
    let prevOrder: string | null = null
    let nextOrder: string | null = null

    if (prevId) {
        const [prev] = await db
            .select({ displayOrder: characterPrompts.displayOrder })
            .from(characterPrompts)
            .where(eq(characterPrompts.id, prevId))
        prevOrder = prev?.displayOrder ?? null
    }

    if (nextId) {
        const [next] = await db
            .select({ displayOrder: characterPrompts.displayOrder })
            .from(characterPrompts)
            .where(eq(characterPrompts.id, nextId))
        nextOrder = next?.displayOrder ?? null
    }

    const displayOrder = generateKeyBetween(prevOrder, nextOrder)

    const [updated] = await db
        .update(characterPrompts)
        .set({ displayOrder, updatedAt: new Date().toISOString() })
        .where(eq(characterPrompts.id, id))
        .returning()

    return updated ?? null
}

export async function remove(id: number) {
    const [existing] = await db.select().from(characterPrompts).where(eq(characterPrompts.id, id))
    if (!existing) return false

    await db.delete(characterPrompts).where(eq(characterPrompts.id, id))
    return true
}
