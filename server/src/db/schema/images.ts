import type { CharacterPrompt, ImageMetadata, Parameters } from '@nai-factory/shared'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { createdAt, position } from '../columns'
import { assets } from './assets'
import { scenes, sceneVariations } from './projects'

export const images = sqliteTable(
    'images',
    {
        id: integer('id').primaryKey(),
        sceneId: integer('scene_id')
            .notNull()
            .references(() => scenes.id, { onDelete: 'cascade' }),
        variationId: integer('variation_id').references(() => sceneVariations.id, {
            onDelete: 'set null',
        }),
        position: position(),
        assetId: integer('asset_id')
            .notNull()
            .references(() => assets.id, { onDelete: 'restrict' }),
        thumbAssetId: integer('thumb_asset_id')
            .notNull()
            .references(() => assets.id, { onDelete: 'restrict' }),
        seed: integer('seed'),
        /** Snapshot of the generation parameters. */
        metadata: text('metadata', { mode: 'json' }).notNull().$type<ImageMetadata>(),
        createdAt: createdAt(),
    },
    (t) => [
        index('images_scene_id_position_id_idx').on(t.sceneId, t.position, t.id),
        index('images_scene_id_variation_id_idx').on(t.sceneId, t.variationId),
        index('images_asset_id_idx').on(t.assetId),
        index('images_thumb_asset_id_idx').on(t.thumbAssetId),
    ],
)

export const playgroundImages = sqliteTable(
    'playground_images',
    {
        id: integer('id').primaryKey(),
        assetId: integer('asset_id')
            .notNull()
            .references(() => assets.id, { onDelete: 'restrict' }),
        thumbAssetId: integer('thumb_asset_id')
            .notNull()
            .references(() => assets.id, { onDelete: 'restrict' }),
        prompt: text('prompt').notNull(),
        negativePrompt: text('negative_prompt').notNull(),
        characterPrompts: text('character_prompts', { mode: 'json' })
            .notNull()
            .$type<CharacterPrompt[]>()
            .default([]),
        parameters: text('parameters', { mode: 'json' }).notNull().$type<Parameters>(),
        seed: integer('seed'),
        metadata: text('metadata', { mode: 'json' }).notNull().$type<ImageMetadata>(),
        createdAt: createdAt(),
    },
    (t) => [
        index('playground_images_created_at_id_idx').on(t.createdAt, t.id),
        index('playground_images_asset_id_idx').on(t.assetId),
        index('playground_images_thumb_asset_id_idx').on(t.thumbAssetId),
    ],
)
