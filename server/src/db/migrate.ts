import type { Database } from 'bun:sqlite'
import { readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import logger from '../logger'
import InitialPath from './migrations/0000_initial.sql' with { type: 'file' }
import OrderedVariablesPath from './migrations/0001_ordered_variables.sql' with { type: 'file' }
import DebugRequestsPath from './migrations/0002_debug_requests.sql' with { type: 'file' }

const log = logger.child({ module: 'migrate' })

const migrations: { tag: string; path: string }[] = [
    { tag: '0000_initial', path: InitialPath },
    { tag: '0001_ordered_variables', path: OrderedVariablesPath },
    { tag: '0002_debug_requests', path: DebugRequestsPath },
]

function resolveMigrationPath(path: string) {
    if (path.startsWith('$bunfs/') || isAbsolute(path)) return path
    return join(import.meta.dir, path)
}

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

        const statements = readFileSync(resolveMigrationPath(migration.path), 'utf8')
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
