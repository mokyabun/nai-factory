import { eq, inArray, type SQL, sql } from 'drizzle-orm'

import { assets, type DbOrTx } from '@/db'

export type AssetRow = typeof assets.$inferSelect
export type AssetInsert = typeof assets.$inferInsert

export function getById(db: DbOrTx, id: number) {
    return db.select().from(assets).where(eq(assets.id, id)).get() ?? null
}

export function getByIds(db: DbOrTx, ids: number[]) {
    if (ids.length === 0) return []
    return db.select().from(assets).where(inArray(assets.id, ids)).all()
}

export function insert(db: DbOrTx, values: AssetInsert) {
    return db.insert(assets).values(values).returning().get()
}

export function allRelPaths(db: DbOrTx) {
    return new Set(
        db
            .select({ relPath: assets.relPath })
            .from(assets)
            .all()
            .map((row) => row.relPath),
    )
}

/** Every column that references `assets.id`. Keep in sync with the schema. */
const UNREFERENCED = sql`
    NOT EXISTS (SELECT 1 FROM images i WHERE i.asset_id = a.id OR i.thumb_asset_id = a.id)
    AND NOT EXISTS (SELECT 1 FROM playground_images p WHERE p.asset_id = a.id OR p.thumb_asset_id = a.id)
    AND NOT EXISTS (SELECT 1 FROM vibe_transfers v WHERE v.source_asset_id = a.id OR v.encoded_asset_id = a.id)
    AND NOT EXISTS (
        SELECT 1 FROM character_references c
        WHERE c.source_asset_id = a.id OR c.thumb_asset_id = a.id OR c.processed_asset_id = a.id
    )
`

export function findUnreferenced(db: DbOrTx, ids?: number[]) {
    if (ids?.length === 0) return []
    const filter: SQL = ids
        ? sql`a.id IN (${sql.join(
              ids.map((id) => sql`${id}`),
              sql`, `,
          )}) AND`
        : sql``
    return db.all<{ id: number; relPath: string }>(
        sql`SELECT a.id AS id, a.rel_path AS relPath FROM assets a WHERE ${filter} ${UNREFERENCED}`,
    )
}

export function deleteByIds(db: DbOrTx, ids: number[]) {
    if (ids.length === 0) return
    db.delete(assets).where(inArray(assets.id, ids)).run()
}
