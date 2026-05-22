import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from './migrate'
import * as schema from './schema'

const DB_PATH = process.env.DATABASE_URL ?? './data/database.db'

interface DbOptions {
    inMemory?: boolean
    wal?: boolean
    cacheSize?: number
}

const defaultOptions: DbOptions = {
    inMemory: false,
    wal: true,
    cacheSize: 10000,
}

export function createDb(options: DbOptions = {}) {
    const mergedOptions = { ...defaultOptions, ...options }

    if (mergedOptions.inMemory) {
        const sqlite = new Database(':memory:')
        sqlite.run('PRAGMA foreign_keys = ON;')
        migrate(sqlite)
        return { db: drizzle(sqlite, { schema }), sqlite, ...schema }
    }

    mkdirSync(dirname(DB_PATH), { recursive: true })

    const sqlite = new Database(DB_PATH)
    if (mergedOptions.wal) {
        sqlite.run('PRAGMA journal_mode = WAL;')
    }

    sqlite.run('PRAGMA foreign_keys = ON;')
    sqlite.run(`PRAGMA cache_size = ${mergedOptions.cacheSize};`)

    migrate(sqlite)

    return { db: drizzle(sqlite, { schema }), sqlite, ...schema }
}

export const { db, sqlite } = createDb()
