import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as schema from '@/db/schema'

/**
 * Applies the final database schema directly without running the incremental
 * migration chain, which has a known compatibility issue in SQLite when one
 * migration drops a column that is still referenced by an index created in an
 * earlier migration.
 */
function applySchema(sqlite: Database) {
    // groups (created in migration 0000, not touched by 0003)
    sqlite.run(`
        CREATE TABLE IF NOT EXISTS \`groups\` (
            \`id\`         integer PRIMARY KEY NOT NULL,
            \`name\`       text NOT NULL,
            \`created_at\` text DEFAULT (datetime('now')) NOT NULL,
            \`updated_at\` text DEFAULT (datetime('now')) NOT NULL
        )
    `)
    sqlite.run(`CREATE INDEX IF NOT EXISTS groups_name_idx ON \`groups\` (\`name\`)`)

    // The rest mirrors migration 0003_schema_rewrite.sql exactly
    sqlite.run(`
        CREATE TABLE IF NOT EXISTS \`projects\` (
            \`id\`                integer PRIMARY KEY NOT NULL,
            \`group_id\`          integer REFERENCES \`groups\`(\`id\`) ON DELETE CASCADE,
            \`name\`              text NOT NULL,
            \`prompt\`            text DEFAULT '' NOT NULL,
            \`negative_prompt\`   text DEFAULT '' NOT NULL,
            \`variables\`         text DEFAULT '{}' NOT NULL,
            \`parameters\`        text DEFAULT '{"model":"nai-diffusion-4-5-full","qualityToggle":false,"width":512,"height":512,"steps":28,"promptGuidance":6,"varietyPlus":false,"seed":0,"sampler":"k_euler_ancestral","promptGuidanceRescale":0.7,"noiseSchedule":"karras","normalizeReferenceStrengthValues":false,"useCharacterPositions":false}' NOT NULL,
            \`character_prompts\` text DEFAULT '[]' NOT NULL,
            \`created_at\`        text DEFAULT (datetime('now')) NOT NULL,
            \`updated_at\`        text DEFAULT (datetime('now')) NOT NULL
        )
    `)
    sqlite.run(
        `CREATE INDEX IF NOT EXISTS projects_group_id_name_idx ON \`projects\` (\`group_id\`, \`name\`)`,
    )

    sqlite.run(`
        CREATE TABLE IF NOT EXISTS \`vibe_transfers\` (
            \`id\`                           integer PRIMARY KEY NOT NULL,
            \`project_id\`                   integer NOT NULL REFERENCES \`projects\`(\`id\`) ON DELETE CASCADE,
            \`display_order\`                text DEFAULT '' NOT NULL,
            \`source_image_path\`            text NOT NULL,
            \`reference_strength\`           real DEFAULT 0.6 NOT NULL,
            \`information_extracted\`        real DEFAULT 1.0 NOT NULL,
            \`encoded_data\`                 text,
            \`encoded_information_extracted\` real,
            \`created_at\`                   text DEFAULT (datetime('now')) NOT NULL,
            \`updated_at\`                   text DEFAULT (datetime('now')) NOT NULL
        )
    `)
    sqlite.run(
        `CREATE INDEX IF NOT EXISTS vibe_transfers_project_id_idx ON \`vibe_transfers\` (\`project_id\`)`,
    )

    sqlite.run(`
        CREATE TABLE IF NOT EXISTS \`scenes\` (
            \`id\`                integer PRIMARY KEY NOT NULL,
            \`project_id\`        integer NOT NULL REFERENCES \`projects\`(\`id\`) ON DELETE CASCADE,
            \`display_order\`     text NOT NULL,
            \`thumbnail_image_id\` integer,
            \`name\`              text NOT NULL,
            \`variations\`        text DEFAULT '[]' NOT NULL,
            \`created_at\`        text DEFAULT (datetime('now')) NOT NULL,
            \`updated_at\`        text DEFAULT (datetime('now')) NOT NULL
        )
    `)
    sqlite.run(
        `CREATE INDEX IF NOT EXISTS scenes_display_order_idx ON \`scenes\` (\`project_id\`, \`display_order\`)`,
    )

    sqlite.run(`
        CREATE TABLE IF NOT EXISTS \`images\` (
            \`id\`             integer PRIMARY KEY NOT NULL,
            \`scene_id\`       integer NOT NULL REFERENCES \`scenes\`(\`id\`) ON DELETE CASCADE,
            \`display_order\`  text NOT NULL,
            \`file_path\`      text NOT NULL,
            \`thumbnail_path\` text,
            \`metadata\`       text DEFAULT '{}' NOT NULL,
            \`created_at\`     text DEFAULT (datetime('now')) NOT NULL
        )
    `)
    sqlite.run(
        `CREATE INDEX IF NOT EXISTS images_scene_id_display_order_idx ON \`images\` (\`scene_id\`, \`display_order\`)`,
    )

    sqlite.run(`
        CREATE TABLE IF NOT EXISTS \`queue_items\` (
            \`id\`              integer PRIMARY KEY NOT NULL,
            \`project_id\`      integer NOT NULL REFERENCES \`projects\`(\`id\`) ON DELETE CASCADE,
            \`scene_id\`        integer NOT NULL REFERENCES \`scenes\`(\`id\`) ON DELETE CASCADE,
            \`variation_count\` integer NOT NULL,
            \`sort_index\`      integer NOT NULL
        )
    `)
    sqlite.run(
        `CREATE INDEX IF NOT EXISTS queue_items_sort_index_idx ON \`queue_items\` (\`sort_index\`)`,
    )

    sqlite.run(`
        CREATE TABLE IF NOT EXISTS \`settings\` (
            \`id\`               integer PRIMARY KEY DEFAULT 1 NOT NULL,
            \`global_variables\` text DEFAULT '{}' NOT NULL,
            \`novelai\`          text DEFAULT '{"apiKey":""}' NOT NULL,
            \`image\`            text DEFAULT '{"sourceType":{"type":"png"},"thumbnailType":{"type":"webp","quality":60},"thumbnailSize":512}' NOT NULL,
            \`updated_at\`       text DEFAULT (datetime('now')) NOT NULL
        )
    `)
}

/**
 * Creates an isolated in-memory SQLite database with the final schema applied.
 * Returns the Drizzle `db` instance plus all schema table references, matching
 * the shape exported by `@/db`.
 */
export function makeTestDb() {
    const sqlite = new Database(':memory:')
    sqlite.run('PRAGMA foreign_keys = ON;')
    applySchema(sqlite)
    const db = drizzle(sqlite, { schema })
    return { db, sqlite, ...schema }
}
