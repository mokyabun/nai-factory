import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { appConfig } from '../config'
import { migrate } from './migrate'
import * as schema from './schema'

interface DbOptions {
    inMemory?: boolean
    path?: string
    wal?: boolean
    cacheSize?: number
}

const defaultOptions: DbOptions = {
    inMemory: false,
    path: appConfig.database.url,
    wal: appConfig.database.wal,
    cacheSize: appConfig.database.cacheSize,
}

export function createDb(options: DbOptions = {}) {
    const mergedOptions = { ...defaultOptions, ...options }

    if (mergedOptions.inMemory) {
        const sqlite = new Database(':memory:')
        sqlite.run('PRAGMA foreign_keys = ON;')
        migrate(sqlite)
        return { db: drizzle(sqlite, { schema }), sqlite, ...schema }
    }

    if (!mergedOptions.path) {
        throw new Error('Database path is required')
    }

    mkdirSync(dirname(mergedOptions.path), { recursive: true })

    const sqlite = new Database(mergedOptions.path)
    if (mergedOptions.wal) {
        sqlite.run('PRAGMA journal_mode = WAL;')
    }

    sqlite.run('PRAGMA foreign_keys = ON;')
    sqlite.run(`PRAGMA cache_size = ${mergedOptions.cacheSize};`)

    migrate(sqlite)

    return { db: drizzle(sqlite, { schema }), sqlite, ...schema }
}

export const { db, sqlite } = createDb()
