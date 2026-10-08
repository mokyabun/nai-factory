import type { Database } from 'bun:sqlite'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'

export const LEGACY_DATABASE_MESSAGE =
    '이전 버전 DB입니다. 새 데이터 폴더를 지정하거나 기존 폴더를 비우세요 (This database was created by an older, incompatible version. Use a new data folder or empty the existing one.)'

export class LegacyDatabaseError extends Error {
    constructor() {
        super(LEGACY_DATABASE_MESSAGE)
        this.name = 'LegacyDatabaseError'
    }
}

/** `src/db/migrations` in development, `dist/migrations` next to the bundled server. */
export function defaultMigrationsDir() {
    return join(import.meta.dir, 'migrations')
}

/** Databases from before the drizzle-kit migrations kept a hand-rolled history table. */
export function assertNotLegacy(sqlite: Database) {
    const legacy = sqlite
        .query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_migration_history'")
        .get()
    if (legacy) throw new LegacyDatabaseError()
}

export function runMigrations(
    sqlite: Database,
    db: BunSQLiteDatabase<Record<string, unknown>>,
    migrationsDir = defaultMigrationsDir(),
) {
    assertNotLegacy(sqlite)
    if (!existsSync(join(migrationsDir, 'meta', '_journal.json'))) {
        throw new Error(`Migrations not found in ${migrationsDir}`)
    }
    migrate(db, { migrationsFolder: migrationsDir })
}
