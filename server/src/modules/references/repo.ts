import { asc, desc, eq } from 'drizzle-orm'

import { characterReferences, type DbOrTx, vibeTransfers } from '@/db'

export type VibeRow = typeof vibeTransfers.$inferSelect
export type VibeInsert = typeof vibeTransfers.$inferInsert
export type CharRefRow = typeof characterReferences.$inferSelect
export type CharRefInsert = typeof characterReferences.$inferInsert

export const vibes = {
    list(db: DbOrTx, projectId: number) {
        return db
            .select()
            .from(vibeTransfers)
            .where(eq(vibeTransfers.projectId, projectId))
            .orderBy(asc(vibeTransfers.position), asc(vibeTransfers.id))
            .all()
    },
    get(db: DbOrTx, id: number) {
        return db.select().from(vibeTransfers).where(eq(vibeTransfers.id, id)).get() ?? null
    },
    lastPosition(db: DbOrTx, projectId: number) {
        return (
            db
                .select({ position: vibeTransfers.position })
                .from(vibeTransfers)
                .where(eq(vibeTransfers.projectId, projectId))
                .orderBy(desc(vibeTransfers.position), desc(vibeTransfers.id))
                .limit(1)
                .get()?.position ?? null
        )
    },
    insert(db: DbOrTx, values: VibeInsert) {
        return db.insert(vibeTransfers).values(values).returning().get()
    },
    update(db: DbOrTx, id: number, values: Partial<VibeInsert>) {
        return (
            db
                .update(vibeTransfers)
                .set(values)
                .where(eq(vibeTransfers.id, id))
                .returning()
                .get() ?? null
        )
    },
    remove(db: DbOrTx, id: number) {
        db.delete(vibeTransfers).where(eq(vibeTransfers.id, id)).run()
    },
    markUploaded(db: DbOrTx, uploads: { id: number; cacheKey: string }[], at: Date) {
        for (const upload of uploads) {
            db.update(vibeTransfers)
                .set({ cacheKey: upload.cacheKey, cacheCreatedAt: at })
                .where(eq(vibeTransfers.id, upload.id))
                .run()
        }
    },
}

export const charRefs = {
    list(db: DbOrTx, projectId: number) {
        return db
            .select()
            .from(characterReferences)
            .where(eq(characterReferences.projectId, projectId))
            .orderBy(asc(characterReferences.position), asc(characterReferences.id))
            .all()
    },
    get(db: DbOrTx, id: number) {
        return (
            db.select().from(characterReferences).where(eq(characterReferences.id, id)).get() ??
            null
        )
    },
    lastPosition(db: DbOrTx, projectId: number) {
        return (
            db
                .select({ position: characterReferences.position })
                .from(characterReferences)
                .where(eq(characterReferences.projectId, projectId))
                .orderBy(desc(characterReferences.position), desc(characterReferences.id))
                .limit(1)
                .get()?.position ?? null
        )
    },
    insert(db: DbOrTx, values: CharRefInsert) {
        return db.insert(characterReferences).values(values).returning().get()
    },
    update(db: DbOrTx, id: number, values: Partial<CharRefInsert>) {
        return (
            db
                .update(characterReferences)
                .set(values)
                .where(eq(characterReferences.id, id))
                .returning()
                .get() ?? null
        )
    },
    remove(db: DbOrTx, id: number) {
        db.delete(characterReferences).where(eq(characterReferences.id, id)).run()
    },
    markUploaded(db: DbOrTx, uploads: { id: number; cacheKey: string }[], at: Date) {
        for (const upload of uploads) {
            db.update(characterReferences)
                .set({ cacheKey: upload.cacheKey, cacheCreatedAt: at })
                .where(eq(characterReferences.id, upload.id))
                .run()
        }
    },
}
