import type { Database } from 'bun:sqlite'
import { readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import logger from '../logger'
import InitialPath from './migrations/0000_initial.sql' with { type: 'file' }

const log = logger.child({ module: 'migrate' })

const migrations: { tag: string; path: string }[] = [{ tag: '0000_initial', path: InitialPath }]

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

        db.transaction(() => {
            for (const statement of statements) {
                db.run(statement)
            }

            db.run('INSERT INTO _migration_history (tag, applied_at) VALUES (?, ?)', [
                migration.tag,
                Date.now(),
            ])
        })()
    }

    ensureNestedGroupSchema(db)

    log.info({ event: 'db.migrations.completed' }, 'Migrations complete')
}

function ensureNestedGroupSchema(db: Database) {
    const columns = db.query("PRAGMA table_info('groups')").all() as { name: string }[]
    if (columns.some((column) => column.name === 'parent_group_id')) return

    log.info(
        { event: 'db.schema.compat', table: 'groups', column: 'parent_group_id' },
        'Adding nested group parent column',
    )

    db.transaction(() => {
        db.run(`
            ALTER TABLE groups
            ADD COLUMN parent_group_id integer REFERENCES groups(id) ON DELETE cascade
        `)
        db.run(`
            CREATE INDEX IF NOT EXISTS groups_parent_group_id_name_id_idx
            ON groups (parent_group_id, name, id)
        `)
    })()
}
