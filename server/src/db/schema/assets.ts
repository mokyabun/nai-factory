import type { AssetKind } from '@nai-factory/shared'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { createdAt } from '../columns'

/** Every stored file. Paths are relative to the data root and `/`-separated. */
export const assets = sqliteTable('assets', {
    id: integer('id').primaryKey(),
    kind: text('kind').notNull().$type<AssetKind>(),
    relPath: text('rel_path').notNull().unique(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    width: integer('width'),
    height: integer('height'),
    sha256: text('sha256').notNull(),
    encrypted: integer('encrypted', { mode: 'boolean' }).notNull(),
    createdAt: createdAt(),
})
