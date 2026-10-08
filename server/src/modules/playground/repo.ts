import { desc, eq } from 'drizzle-orm'

import { type DbOrTx, playgroundImages, playgroundState } from '@/db'

export type StateRow = typeof playgroundState.$inferSelect
export type ImageRow = typeof playgroundImages.$inferSelect
export type ImageInsert = typeof playgroundImages.$inferInsert

export function getState(db: DbOrTx) {
    return db.select().from(playgroundState).where(eq(playgroundState.id, 1)).get() ?? null
}

export function saveState(db: DbOrTx, values: Omit<typeof playgroundState.$inferInsert, 'id'>) {
    return db
        .insert(playgroundState)
        .values({ id: 1, ...values })
        .onConflictDoUpdate({
            target: playgroundState.id,
            set: { ...values, updatedAt: new Date() },
        })
        .returning()
        .get()
}

export function listImages(db: DbOrTx, limit: number) {
    return db
        .select()
        .from(playgroundImages)
        .orderBy(desc(playgroundImages.createdAt), desc(playgroundImages.id))
        .limit(limit)
        .all()
}

export function getImage(db: DbOrTx, id: number) {
    return db.select().from(playgroundImages).where(eq(playgroundImages.id, id)).get() ?? null
}

export function insertImage(db: DbOrTx, values: typeof playgroundImages.$inferInsert) {
    return db.insert(playgroundImages).values(values).returning().get()
}

export function removeImage(db: DbOrTx, id: number) {
    db.delete(playgroundImages).where(eq(playgroundImages.id, id)).run()
}
