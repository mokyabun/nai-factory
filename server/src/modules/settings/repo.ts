import { eq } from 'drizzle-orm'

import { type DbOrTx, secrets, settings } from '@/db'

export type SettingsRow = typeof settings.$inferSelect
export type SettingsInsert = typeof settings.$inferInsert

export function get(db: DbOrTx) {
    return db.select().from(settings).where(eq(settings.id, 1)).get() ?? null
}

export function upsert(db: DbOrTx, values: Omit<SettingsInsert, 'id'>) {
    return db
        .insert(settings)
        .values({ id: 1, ...values })
        .onConflictDoUpdate({ target: settings.id, set: { ...values, updatedAt: new Date() } })
        .returning()
        .get()
}

export function getSecret(db: DbOrTx, key: string) {
    return db.select().from(secrets).where(eq(secrets.key, key)).get()?.value ?? null
}

export function setSecret(db: DbOrTx, key: string, value: string) {
    db.insert(secrets)
        .values({ key, value })
        .onConflictDoUpdate({ target: secrets.key, set: { value, updatedAt: new Date() } })
        .run()
}

export function deleteSecret(db: DbOrTx, key: string) {
    db.delete(secrets).where(eq(secrets.key, key)).run()
}
