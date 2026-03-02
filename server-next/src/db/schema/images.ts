import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { scenes } from './scenes'

export const images = sqliteTable(
    'images',
    {
        id: integer('id').primaryKey({ autoIncrement: true }),
        sceneId: integer('scene_id')
            .notNull()
            .references(() => scenes.id, { onDelete: 'cascade' }),

        displayOrder: text('display_order').notNull(),

        filePath: text('file_path').notNull(),
        thumbnailPath: text('thumbnail_path'),
        metadata: text('metadata', { mode: 'json' }).notNull().default({}),

        createdAt: text('created_at')
            .notNull()
            .default(sql`(datetime('now'))`),
    },
    (t) => [index('images_scene_id_idx').on(t.sceneId)],
)
