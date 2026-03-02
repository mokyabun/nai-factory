import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const groups = sqliteTable(
    'groups',
    {
        id: integer('id').primaryKey({ autoIncrement: true }),
        name: text('name').notNull(),
        createdAt: text('created_at')
            .notNull()
            .default(sql`(datetime('now'))`),
        updatedAt: text('updated_at')
            .notNull()
            .default(sql`(datetime('now'))`),
    },
    (t) => [index('groups_name_idx').on(t.name)],
)
