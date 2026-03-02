import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { projects } from './projects'

export const scenes = sqliteTable(
    'scenes',
    {
        id: integer('id').primaryKey({ autoIncrement: true }),
        projectId: integer('project_id')
            .notNull()
            .references(() => projects.id, { onDelete: 'cascade' }),

        displayOrder: text('display_order').notNull(),

        name: text('name').notNull(),
        imageCount: integer('image_count').notNull().default(0),

        createdAt: text('created_at')
            .notNull()
            .default(sql`(datetime('now'))`),
        updatedAt: text('updated_at')
            .notNull()
            .default(sql`(datetime('now'))`),
    },
    (t) => [index('scenes_project_id_idx').on(t.projectId)],
)
