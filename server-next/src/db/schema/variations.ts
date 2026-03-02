import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { PromptVariable } from '@/types'
import { scenes } from './scenes'

export const variations = sqliteTable(
    'variations',
    {
        id: integer('id').primaryKey({ autoIncrement: true }),
        sceneId: integer('scene_id')
            .notNull()
            .references(() => scenes.id, { onDelete: 'cascade' }),

        displayOrder: text('display_order').notNull(),

        variables: text('variables', { mode: 'json' })
            .notNull()
            .$type<PromptVariable>()
            .default({}),

        createdAt: text('created_at')
            .notNull()
            .default(sql`(datetime('now'))`),
    },
    (t) => [index('variations_scene_id_idx').on(t.sceneId)],
)
