import type { Database } from 'bun:sqlite'
import logger from '../logger'
// @ts-expect-error Bun imports SQL migrations as text at runtime
import trueAnitaBlake from './migrations/0000_true_anita_blake.sql' with { type: 'text' }
// @ts-expect-error Bun imports SQL migrations as text at runtime
import removeThumbnailImageId from './migrations/0001_remove_thumbnail_image_id.sql' with {
    type: 'text',
}
// @ts-expect-error Bun imports SQL migrations as text at runtime
import addQueueItemsSceneIdIdx from './migrations/0002_add_queue_items_scene_id_idx.sql' with {
    type: 'text',
}
// @ts-expect-error Bun imports SQL migrations as text at runtime
import fixVibeTransfersIndex from './migrations/0003_fix_vibe_transfers_index.sql' with {
    type: 'text',
}
// @ts-expect-error Bun imports SQL migrations as text at runtime
import characterReferencesAndReferenceCache from './migrations/0004_character_references_and_reference_cache.sql' with {
    type: 'text',
}
// @ts-expect-error Bun imports SQL migrations as text at runtime
import projectSettings from './migrations/0005_project_settings.sql' with { type: 'text' }
// @ts-expect-error Bun imports SQL migrations as text at runtime
import debugSettings from './migrations/0006_debug_settings.sql' with { type: 'text' }
// @ts-expect-error Bun imports SQL migrations as text at runtime
import playground from './migrations/0007_playground.sql' with { type: 'text' }

const log = logger.child({ module: 'migrate' })

const migrations: { tag: string; sql: string }[] = [
    { tag: '0000_true_anita_blake', sql: trueAnitaBlake },
    { tag: '0001_remove_thumbnail_image_id', sql: removeThumbnailImageId },
    { tag: '0002_add_queue_items_scene_id_idx', sql: addQueueItemsSceneIdIdx },
    { tag: '0003_fix_vibe_transfers_index', sql: fixVibeTransfersIndex },
    {
        tag: '0004_character_references_and_reference_cache',
        sql: characterReferencesAndReferenceCache,
    },
    { tag: '0005_project_settings', sql: projectSettings },
    { tag: '0006_debug_settings', sql: debugSettings },
    { tag: '0007_playground', sql: playground },
]

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
