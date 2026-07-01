import type { Database } from 'bun:sqlite'
import logger from '../logger'

import Initial from './migrations/0000_initial.sql'
import OrderedVariables from './migrations/0001_ordered_variables.sql'
import DebugRequests from './migrations/0002_debug_requests.sql'

const log = logger.child({ module: 'migrate' })

const migrations: { tag: string; sql: string }[] = [
    { tag: '0000_initial', sql: Initial },
    { tag: '0001_ordered_variables', sql: OrderedVariables },
    { tag: '0002_debug_requests', sql: DebugRequests },
]

export function migrate(db: Database) {
    log.info({ event: 'db.migrations.started' }, 'Running migrations')

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

        log.info({ event: 'db.migration.applying', tag: migration.tag }, 'Applying migration')

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

    log.info({ event: 'db.migrations.completed' }, 'Migrations complete')
}
