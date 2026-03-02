import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { projects } from './projects'

export const vibeTransfers = sqliteTable(
    'vibe_transfers',
    {
        id: integer('id').primaryKey({ autoIncrement: true }),
        projectId: integer('project_id')
            .notNull()
            .references(() => projects.id, { onDelete: 'cascade' }),

        displayOrder: text('display_order').notNull(),

        sourceImagePath: text('source_image_path').notNull(),

        referenceStrength: real('reference_strength').notNull().default(0.6),
        informationExtracted: real('information_extracted').notNull().default(1.0),

        // Encoded vibe data stored as base64 text (~80KB per entry)
        // null = not yet encoded or invalidated
        encodedData: text('encoded_data'),
        encodedInformationExtracted: real('encoded_information_extracted'),

        createdAt: text('created_at')
            .notNull()
            .default(sql`(datetime('now'))`),
        updatedAt: text('updated_at')
            .notNull()
            .default(sql`(datetime('now'))`),
    },
    (t) => [index('vibe_transfers_project_id_idx').on(t.projectId)],
)
