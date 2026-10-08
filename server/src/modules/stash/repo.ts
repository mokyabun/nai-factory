import { asc, eq } from 'drizzle-orm'

import { type DbOrTx, stashItems } from '@/db'

export type StashRow = typeof stashItems.$inferSelect

export function list(db: DbOrTx, type?: StashRow['type']) {
    return db
        .select()
        .from(stashItems)
        .where(type ? eq(stashItems.type, type) : undefined)
        .orderBy(asc(stashItems.name), asc(stashItems.id))
        .all()
}

export function getById(db: DbOrTx, id: number) {
    return db.select().from(stashItems).where(eq(stashItems.id, id)).get() ?? null
}

export function insert(db: DbOrTx, values: typeof stashItems.$inferInsert) {
    return db.insert(stashItems).values(values).returning().get()
}

export function update(db: DbOrTx, id: number, values: Partial<typeof stashItems.$inferInsert>) {
    return db.update(stashItems).set(values).where(eq(stashItems.id, id)).returning().get() ?? null
}

export function remove(db: DbOrTx, id: number) {
    db.delete(stashItems).where(eq(stashItems.id, id)).run()
}
