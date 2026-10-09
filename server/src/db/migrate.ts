import type { Database } from 'bun:sqlite'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'

import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'

import { toFileStamp } from '@/lib/time'

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

type Journal = { entries: { when: number }[] }

const journalPath = (migrationsDir: string) => join(migrationsDir, 'meta', '_journal.json')

/** drizzle applies every journal entry newer than the last recorded `created_at`. */
function lastAppliedAt(sqlite: Database) {
    const table = sqlite
        .query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'")
        .get()
    if (!table) return null
    const row = sqlite
        .query<{ createdAt: number | null }, []>(
            'SELECT MAX(created_at) AS createdAt FROM __drizzle_migrations',
        )
        .get()
    return row?.createdAt == null ? null : Number(row.createdAt)
}

function backupPathFor(databasePath: string) {
    const name = basename(databasePath, extname(databasePath))
    return join(dirname(databasePath), 'backups', `${name}-${toFileStamp(new Date())}.db`)
}

/** Copies the database before pending migrations change it; returns the copy's path, if any. */
export function backupBeforeMigrations(
    sqlite: Database,
    databasePath: string,
    migrationsDir = defaultMigrationsDir(),
) {
    const appliedAt = lastAppliedAt(sqlite)
    if (appliedAt === null || !existsSync(journalPath(migrationsDir))) return null
    const journal = JSON.parse(readFileSync(journalPath(migrationsDir), 'utf8')) as Journal
    const pending = journal.entries.some((entry) => entry.when > appliedAt)
    if (!pending) return null

    const target = backupPathFor(databasePath)
    mkdirSync(dirname(target), { recursive: true })
    sqlite.run('VACUUM INTO ?', [target])
    return target
}

export function runMigrations(
    sqlite: Database,
    db: BunSQLiteDatabase<Record<string, unknown>>,
    migrationsDir = defaultMigrationsDir(),
) {
    assertNotLegacy(sqlite)
    if (!existsSync(journalPath(migrationsDir))) {
        throw new Error(`Migrations not found in ${migrationsDir}`)
    }
    migrate(db, { migrationsFolder: migrationsDir })
}
