import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import { migrate } from './migrate'
import * as schema from './schema'

const DB_PATH = process.env.DATABASE_URL ?? './data/database.db'

function createDb() {
    mkdirSync(dirname(DB_PATH), { recursive: true })

    const sqlite = new Database(DB_PATH)
    sqlite.run('PRAGMA journal_mode = WAL;')
    sqlite.run('PRAGMA foreign_keys = ON;')

    // add cache
    sqlite.run('PRAGMA cache_size = 10000;')

    migrate(sqlite)

    return {
        db: drizzle(sqlite, { schema }),
        sqlite,
    }
}

export const { db, sqlite } = createDb()

export * from './schema'
