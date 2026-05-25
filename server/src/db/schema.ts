import type {
    CharacterPrompt,
    GlobalSettings,
    Parameters,
    ProjectSettings,
    PromptVariable,
} from '@nai-factory/types'
import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// Groups
export const groups = sqliteTable(
    'groups',
    {
        id: integer('id').primaryKey(),
        name: text('name').notNull(),
        createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
        updatedAt: text('updated_at')
            .notNull()
            .default(sql`(datetime('now'))`)
            .$onUpdate(() => new Date().toISOString()),
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

        settings: text('settings', { mode: 'json' })
            .notNull()
            .$type<ProjectSettings>()
            .default({ slideshowImageCount: 4 }),

        createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
        updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
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

        cacheSecretKey: text('cache_secret_key'),
        cacheCreatedAt: text('cache_created_at'),

        createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
        updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
    },
    (t) => [index('vibe_transfers_project_id_display_order_idx').on(t.projectId, t.displayOrder)],
)

// Character References
export const characterReferences = sqliteTable(
    'character_references',
    {
        id: integer('id').primaryKey(),
        projectId: integer('project_id')
            .notNull()
            .references(() => projects.id, { onDelete: 'cascade' }),

        displayOrder: text('display_order').notNull().default(''),

        sourceImagePath: text('source_image_path').notNull(),
        thumbnailPath: text('thumbnail_path'),
        processedImagePath: text('processed_image_path'),

        strength: real('strength').notNull().default(0.6),
        fidelity: real('fidelity').notNull().default(0.5),
        referenceMode: text('reference_mode').notNull().default('character&style'),
        enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),

        cacheSecretKey: text('cache_secret_key'),
        cacheCreatedAt: text('cache_created_at'),

        createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
        updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
    },
    (t) => [
        index('character_references_project_id_display_order_idx').on(t.projectId, t.displayOrder),
    ],
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

        name: text('name').notNull(),

        createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
        updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
    },
    (t) => [index('scenes_display_order_idx').on(t.projectId, t.displayOrder)],
)

export const sceneVariations = sqliteTable(
    'scene_variations',
    {
        id: integer('id').primaryKey(),
        sceneId: integer('scene_id')
            .notNull()
            .references(() => scenes.id, { onDelete: 'cascade' }),

        displayOrder: text('display_order').notNull(),
        variables: text('variables', { mode: 'json' })
            .notNull()
            .$type<PromptVariable>()
            .default({}),

        createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
        updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
    },
    (t) => [index('scene_variations_scene_id_display_order_idx').on(t.sceneId, t.displayOrder)],
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

        createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
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
        sceneVariationId: integer('scene_variation_id')
            .notNull()
            .references(() => sceneVariations.id, { onDelete: 'cascade' }),

        sortIndex: integer('sort_index').notNull(),
    },
    (t) => [
        index('queue_items_sort_index_idx').on(t.sortIndex),
        index('queue_items_scene_id_idx').on(t.sceneId),
        index('queue_items_scene_variation_id_idx').on(t.sceneVariationId),
    ],
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

    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})
