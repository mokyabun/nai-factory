import { eq, sql } from 'drizzle-orm'
import { db, settings } from '@/db'
import type { GlobalSettings, PromptVariable } from '@/types'

async function ensureSettings() {
    const [row] = await db.select().from(settings)
    if (row) return row

    const [created] = await db.insert(settings).values({ id: 1 }).returning()
    return created!
}

export async function getSettings() {
    return ensureSettings()
}

export async function updateGlobalVariables(vars: PromptVariable) {
    await ensureSettings()

    const [updated] = await db
        .update(settings)
        .set({
            globalVariables: vars,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(settings.id, 1))
        .returning()

    return updated!
}

export async function updateNovelaiSettings(data: Partial<GlobalSettings>) {
    const current = await ensureSettings()

    const merged: GlobalSettings = {
        ...current.novelaiSettings,
        ...data,
    }

    const [updated] = await db
        .update(settings)
        .set({
            novelaiSettings: merged,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(settings.id, 1))
        .returning()

    return updated!
}
