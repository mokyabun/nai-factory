import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { projects } from './projects'

export const characterPrompts = sqliteTable(
    'character_prompts',
    {
        id: integer('id').primaryKey({ autoIncrement: true }),
        projectId: integer('project_id')
            .notNull()
            .references(() => projects.id, { onDelete: 'cascade' }),

        displayOrder: text('display_order').notNull(),

        enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
        centerX: real('center_x').notNull().default(0.5),
        centerY: real('center_y').notNull().default(0.5),

        prompt: text('prompt').notNull().default(''),
        uc: text('uc').notNull().default(''), // negative prompt

        createdAt: text('created_at')
            .notNull()
            .default(sql`(datetime('now'))`),
        updatedAt: text('updated_at')
            .notNull()
            .default(sql`(datetime('now'))`),
    },
    (t) => [index('character_prompts_project_id_idx').on(t.projectId)],
)
