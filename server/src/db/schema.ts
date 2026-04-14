import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { CharacterPrompt, GlobalSettings, Parameters, PromptVariable } from '@/types'

// Groups
export const groups = sqliteTable(
    'groups',
    {
        id: integer('id').primaryKey(),
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

export const projects = sqliteTable(
    'projects',
    {
        id: integer('id').primaryKey(),
        groupId: integer('group_id').references(() => groups.id, { onDelete: 'cascade' }),

        name: text('name').notNull(),
        prompt: text('prompt').notNull().default(''),
        negativePrompt: text('negative_prompt').notNull().default(''),

        // JSON columns (always read/written as whole)
        variables: text('variables', { mode: 'json' })
            .notNull()
            .$type<PromptVariable>()
            .default({}),

        parameters: text('parameters', { mode: 'json' }).notNull().$type<Parameters>().default({
            model: 'nai-diffusion-4-5-full',
            qualityToggle: false,

            width: 512,
            height: 512,

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

        characterPrompts: text('character_prompts', { mode: 'json' })
            .notNull()
            .$type<CharacterPrompt[]>()
            .default([]),

        createdAt: text('created_at')
            .notNull()
            .default(sql`(datetime('now'))`),
        updatedAt: text('updated_at')
            .notNull()
            .default(sql`(datetime('now'))`),
    },
    (t) => [index('projects_group_id_name_idx').on(t.groupId, t.name)],
)

// Vibe Transfers
export const vibeTransfers = sqliteTable(
    'vibe_transfers',
    {
        id: integer('id').primaryKey(),
        projectId: integer('project_id')
            .notNull()
            .references(() => projects.id, { onDelete: 'cascade' }),

        displayOrder: text('display_order').notNull().default(''),

        sourceImagePath: text('source_image_path').notNull(),

        referenceStrength: real('reference_strength').notNull().default(0.6),
        informationExtracted: real('information_extracted').notNull().default(1.0),

        // Nullable: empty until encoded by encodeVibe()
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

// Scenes
export const scenes = sqliteTable(
    'scenes',
    {
        id: integer('id').primaryKey(),
        projectId: integer('project_id')
            .notNull()
            .references(() => projects.id, { onDelete: 'cascade' }),

        // Using fractional indexing
        displayOrder: text('display_order').notNull(),

        thumbnailImageId: integer('thumbnail_image_id'),

        name: text('name').notNull(),

        variations: text('variations', { mode: 'json' })
            .notNull()
            .$type<PromptVariable[]>()
            .default([]),

        createdAt: text('created_at')
            .notNull()
            .default(sql`(datetime('now'))`),
        updatedAt: text('updated_at')
            .notNull()
            .default(sql`(datetime('now'))`),
    },
    (t) => [index('scenes_display_order_idx').on(t.projectId, t.displayOrder)],
)

// Images
export const images = sqliteTable(
    'images',
    {
        id: integer('id').primaryKey(),
        sceneId: integer('scene_id')
            .notNull()
            .references(() => scenes.id, { onDelete: 'cascade' }),

        // Using fractional indexing
        displayOrder: text('display_order').notNull(),

        filePath: text('file_path').notNull(),
        thumbnailPath: text('thumbnail_path'),
        metadata: text('metadata', { mode: 'json' }).notNull().default('{}'),

        createdAt: text('created_at')
            .notNull()
            .default(sql`(datetime('now'))`),
    },
    (t) => [index('images_scene_id_display_order_idx').on(t.sceneId, t.displayOrder)],
)

// Queue
export const queueItems = sqliteTable(
    'queue_items',
    {
        id: integer('id').primaryKey(),

        projectId: integer('project_id')
            .notNull()
            .references(() => projects.id, { onDelete: 'cascade' }),
        sceneId: integer('scene_id')
            .notNull()
            .references(() => scenes.id, { onDelete: 'cascade' }),

        variationCount: integer('variation_count').notNull(),

        sortIndex: integer('sort_index').notNull(),
    },
    (t) => [index('queue_items_sort_index_idx').on(t.sortIndex)],
)

export const settings = sqliteTable('settings', {
    id: integer('id').primaryKey().default(1),

    globalVariables: text('global_variables', { mode: 'json' })
        .notNull()
        .$type<GlobalSettings['globalVariables']>()
        .default({}),

    novelai: text('novelai', { mode: 'json' })
        .notNull()
        .$type<GlobalSettings['novelai']>()
        .default({
            apiKey: '',
        }),

    image: text('image', { mode: 'json' })
        .notNull()
        .$type<GlobalSettings['image']>()
        .default({
            sourceType: { type: 'png' },
            thumbnailType: { type: 'webp', quality: 60 },
            thumbnailSize: 512,
        }),

    updatedAt: text('updated_at')
        .notNull()
        .default(sql`(datetime('now'))`),
})
