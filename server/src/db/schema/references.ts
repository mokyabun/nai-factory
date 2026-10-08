import type { CharacterReferenceMode, NovelAIModel } from '@nai-factory/shared'
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { createdAt, position, updatedAt } from '../columns'
import { assets } from './assets'
import { projects } from './projects'

export const vibeTransfers = sqliteTable(
    'vibe_transfers',
    {
        id: integer('id').primaryKey(),
        projectId: integer('project_id')
            .notNull()
            .references(() => projects.id, { onDelete: 'cascade' }),
        position: position(),
        sourceAssetId: integer('source_asset_id')
            .notNull()
            .references(() => assets.id, { onDelete: 'restrict' }),
        encodedAssetId: integer('encoded_asset_id').references(() => assets.id, {
            onDelete: 'set null',
        }),
        /** Model the cached encoding was made for; a different model invalidates it. */
        encodedForModel: text('encoded_for_model').$type<NovelAIModel>(),
        encodedInformationExtracted: real('encoded_information_extracted'),
        referenceStrength: real('reference_strength').notNull(),
        informationExtracted: real('information_extracted').notNull(),
        enabled: integer('enabled', { mode: 'boolean' }).notNull(),
        cacheKey: text('cache_key'),
        cacheCreatedAt: integer('cache_created_at', { mode: 'timestamp_ms' }),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [
        index('vibe_transfers_project_id_position_id_idx').on(t.projectId, t.position, t.id),
        index('vibe_transfers_source_asset_id_idx').on(t.sourceAssetId),
        index('vibe_transfers_encoded_asset_id_idx').on(t.encodedAssetId),
    ],
)

export const characterReferences = sqliteTable(
    'character_references',
    {
        id: integer('id').primaryKey(),
        projectId: integer('project_id')
            .notNull()
            .references(() => projects.id, { onDelete: 'cascade' }),
        position: position(),
        sourceAssetId: integer('source_asset_id')
            .notNull()
            .references(() => assets.id, { onDelete: 'restrict' }),
        thumbAssetId: integer('thumb_asset_id').references(() => assets.id, {
            onDelete: 'set null',
        }),
        processedAssetId: integer('processed_asset_id').references(() => assets.id, {
            onDelete: 'set null',
        }),
        strength: real('strength').notNull(),
        fidelity: real('fidelity').notNull(),
        mode: text('mode').notNull().$type<CharacterReferenceMode>(),
        enabled: integer('enabled', { mode: 'boolean' }).notNull(),
        cacheKey: text('cache_key'),
        cacheCreatedAt: integer('cache_created_at', { mode: 'timestamp_ms' }),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [
        index('character_references_project_id_position_id_idx').on(t.projectId, t.position, t.id),
        index('character_references_source_asset_id_idx').on(t.sourceAssetId),
        index('character_references_thumb_asset_id_idx').on(t.thumbAssetId),
        index('character_references_processed_asset_id_idx').on(t.processedAssetId),
    ],
)
