import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import { type BunSQLiteDatabase, drizzle } from 'drizzle-orm/bun-sqlite'

import { backupBeforeMigrations, runMigrations } from './migrate'
import * as schema from './schema'

export type Db = BunSQLiteDatabase<typeof schema>
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
/** Repository functions accept either the database or an open transaction. */
export type DbOrTx = Db | Tx

export type OpenDatabaseOptions = {
    /** File path or `:memory:`. */
    path: string
    cacheSize?: number
    migrationsDir?: string | null
}

export function openDatabase({ path, cacheSize = 10000, migrationsDir }: OpenDatabaseOptions) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })

    const sqlite = new Database(path, { create: true, strict: true })
    if (path !== ':memory:') sqlite.run('PRAGMA journal_mode = WAL;')
    sqlite.run('PRAGMA foreign_keys = ON;')
    sqlite.run('PRAGMA busy_timeout = 5000;')
    sqlite.run('PRAGMA synchronous = NORMAL;')
    sqlite.run(`PRAGMA cache_size = ${Math.trunc(cacheSize)};`)

    const db = drizzle(sqlite, { schema })
    let backupPath: string | null = null
    try {
        if (path !== ':memory:') {
            backupPath = backupBeforeMigrations(sqlite, path, migrationsDir ?? undefined)
        }
        runMigrations(sqlite, db, migrationsDir ?? undefined)
    } catch (error) {
        sqlite.close()
        throw error
    }

    return { db, sqlite, backupPath }
}
