import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import {
    type CharacterPrompt,
    type GlobalSettings,
    type Parameters,
    type PromptVariable,
    type VibeTransfer,
} from '@/types'

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
        groupId: integer('group_id')
            .notNull()
            .references(() => groups.id, { onDelete: 'cascade' }),

        thumbnailImageId: integer('thumbnail_image_id'),

        name: text('name').notNull(),
        prompt: text('prompt').notNull().default(''),
        negativePrompt: text('negative_prompt').notNull().default(''),

        // JSON columns (always read/written as whole)
        variables: text('variables', { mode: 'json' })
            .notNull()
            .$type<PromptVariable>()
            .default({}),

        parameters: text('parameters', { mode: 'json' }).notNull().$type<Parameters>().default({
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
        id: integer('id').primaryKey({ autoIncrement: true }),
        projectId: integer('project_id')
            .notNull()
            .references(() => projects.id, { onDelete: 'cascade' }),

        sourceImagePath: text('source_image_path').notNull(),

        referenceStrength: real('reference_strength').notNull().default(0.6),
        informationExtracted: real('information_extracted').notNull().default(1.0),

        // Encoded vibe data stored as base64 text (~80KB per entry)
        encodedData: text('encoded_data').notNull(),
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
        id: integer('id').primaryKey({ autoIncrement: true }),
        projectId: integer('project_id')
            .notNull()
            .references(() => projects.id, { onDelete: 'cascade' }),

        // Using fractional indexing
        displayOrder: text('display_order').notNull(),

        name: text('name').notNull(),
        imageCount: integer('image_count').notNull().default(0),

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
        id: integer('id').primaryKey({ autoIncrement: true }),

        projectId: integer('project_id')
            .notNull()
            .references(() => projects.id, { onDelete: 'cascade' }),
        sceneId: integer('scene_id')
            .notNull()
            .references(() => scenes.id, { onDelete: 'cascade' }),

        priority: integer('priority').notNull().default(0),

        createdAt: text('created_at')
            .notNull()
            .default(sql`(datetime('now'))`),
    },
    (t) => [index('queue_items_priority_created_at_idx').on(t.priority, t.createdAt)],
)

export const settings = sqliteTable('settings', {
    id: integer('id').primaryKey().default(1),

    globalVariables: text('global_variables', { mode: 'json' })
        .notNull()
        .$type<PromptVariable>()
        .default({}),
    novelaiSettings: text('novelai_settings', { mode: 'json' })
        .notNull()
        .$type<GlobalSettings>()
        .default({
            novelaiApiKey: '',

            model: 'nai-diffusion-4-5-full',
            qualityToggle: false,
        }),

    updatedAt: text('updated_at')
        .notNull()
        .default(sql`(datetime('now'))`),
})
