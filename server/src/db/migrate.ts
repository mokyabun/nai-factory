import type { Database } from 'bun:sqlite'
import logger from '../logger'

import Initial from './migrations/0000_initial.sql'

const log = logger.child({ module: 'migrate' })

const migrations: { tag: string; sql: string }[] = [{ tag: '0000_initial', sql: Initial }]

export function migrate(db: Database) {
    log.info('Running migrations')

    db.run(`
        CREATE TABLE IF NOT EXISTS _migration_history (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            tag        TEXT    NOT NULL UNIQUE,
            applied_at INTEGER NOT NULL
        )
    `)

    const applied = new Set(
        (db.query('SELECT tag FROM _migration_history').all() as { tag: string }[]).map(
            (r) => r.tag,
        ),
    )

    for (const migration of migrations) {
        if (applied.has(migration.tag)) continue

        log.info({ tag: migration.tag }, 'Applying migration')

        const statements = migration.sql
            .split('--> statement-breakpoint')
            .map((s) => s.trim())
            .filter(Boolean)

        for (const statement of statements) {
            db.run(statement)
        }

        db.run('INSERT INTO _migration_history (tag, applied_at) VALUES (?, ?)', [
            migration.tag,
            Date.now(),
        ])
    }

    log.info('Migrations complete')
}
