import type { Database } from 'bun:sqlite'
import logger from '@/logger'
import migration0000 from './migrations/0000_damp_darkstar.sql' with { type: 'text' }

interface Migration {
    tag: string
    sql: string
}

// Migrations are imported at the top and registered here.
// Add new migrations by importing the SQL file and appending to this array.
const migrations: Migration[] = [{ tag: '0000_damp_darkstar', sql: migration0000 }]

export function migrate(db: Database) {
    const log = logger.child({ module: 'migrate' })

    db.run(`
        CREATE TABLE IF NOT EXISTS _migration_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tag TEXT NOT NULL UNIQUE,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `)

    const applied = new Set(
        db
            .query('SELECT tag FROM _migration_history')
            .all()
            .map((row: any) => row.tag),
    )

    for (const migration of migrations) {
        if (applied.has(migration.tag)) continue

        log.info({ tag: migration.tag }, 'Applying migration')

        const statements = migration.sql
            .split('--> statement-breakpoint')
            .map((s) => s.trim())
            .filter(Boolean)

        db.transaction(() => {
            for (const stmt of statements) {
                db.run(stmt)
            }
            db.run('INSERT INTO _migration_history (tag) VALUES (?)', [migration.tag])
        })()

        log.info({ tag: migration.tag }, 'Migration applied')
    }
}
