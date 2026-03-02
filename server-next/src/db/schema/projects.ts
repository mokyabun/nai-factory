import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { Parameters, PromptVariable } from '@/types'
import { groups } from './groups'

export const projects = sqliteTable(
    'projects',
    {
        id: integer('id').primaryKey({ autoIncrement: true }),
        groupId: integer('group_id')
            .notNull()
            .references(() => groups.id, { onDelete: 'cascade' }),

        thumbnailImageId: integer('thumbnail_image_id'),

        // Fractional indexing for ordering
        displayOrder: text('display_order').notNull(),

        name: text('name').notNull(),
        prompt: text('prompt').notNull().default(''),
        negativePrompt: text('negative_prompt').notNull().default(''),

        // JSON columns (config objects — always read/written as whole)
        variables: text('variables', { mode: 'json' })
            .notNull()
            .$type<PromptVariable>()
            .default({}),

        parameters: text('parameters', { mode: 'json' }).notNull().$type<Parameters>().default({
            width: 832,
            height: 1216,
            steps: 28,
            promptGuidance: 6,
            varietyPlus: false,
            seed: 0,
            sampler: 'k_euler_ancestral',
            promptGuidanceRescale: 0.7,
            noiseSchedule: 'karras',
            normalizeReferenceStrengthValues: false,
            useCharacterPositions: false,
        }),

        createdAt: text('created_at')
            .notNull()
            .default(sql`(datetime('now'))`),
        updatedAt: text('updated_at')
            .notNull()
            .default(sql`(datetime('now'))`),
    },
    (t) => [index('projects_group_id_idx').on(t.groupId), index('projects_name_idx').on(t.name)],
)
