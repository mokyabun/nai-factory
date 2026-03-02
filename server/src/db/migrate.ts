import type { Database } from 'bun:sqlite'
// @ts-ignore
import unique_nextwave from './migrations/0000_unique_nextwave.sql' with { type: 'text' }
// @ts-ignore
import add_queue_priority from './migrations/0001_add_queue_priority.sql' with { type: 'text' }
// @ts-ignore
import simplify_queue_items from './migrations/0002_simplify_queue_items.sql' with { type: 'text' }

const migrations: { tag: string; sql: string }[] = [
    { tag: '0000_unique_nextwave', sql: unique_nextwave },
    { tag: '0001_add_queue_priority', sql: add_queue_priority },
    { tag: '0002_simplify_queue_items', sql: simplify_queue_items },
]

export function migrate(db: Database) {
    console.log('Running migrations...')

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

        console.log(`Applying migration: ${migration.tag}`)

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

    console.log('Migrations complete.')
}
