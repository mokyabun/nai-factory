import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { projects } from './projects'
import { scenes } from './scenes'
import { variations } from './variations'

export const queueItems = sqliteTable(
    'queue_items',
    {
        id: integer('id').primaryKey({ autoIncrement: true }),

        projectId: integer('project_id')
            .notNull()
            .references(() => projects.id, { onDelete: 'cascade' }),
        sceneId: integer('scene_id')
            .notNull()
            .references(() => scenes.id, { onDelete: 'cascade' }),
        variationId: integer('variation_id').references(() => variations.id, {
            onDelete: 'set null',
        }),

        priority: integer('priority').notNull().default(0),

        createdAt: text('created_at')
            .notNull()
            .default(sql`(datetime('now'))`),
    },
    (t) => [index('queue_items_priority_created_at_idx').on(t.priority, t.createdAt)],
)
