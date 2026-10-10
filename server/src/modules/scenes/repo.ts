import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'

import { type DbOrTx, scenes, sceneVariations } from '@/db'

export type SceneRow = typeof scenes.$inferSelect
export type VariationRow = typeof sceneVariations.$inferSelect

export type LatestImageRow = {
    id: number
    variationId: number | null
    position: string
    assetId: number
    thumbAssetId: number
    createdAt: number
}

export const LATEST_IMAGE_COUNT = 10

// Literal `scenes.id` in subqueries: drizzle renders interpolated columns unqualified here.
const summaryColumns = {
    id: scenes.id,
    projectId: scenes.projectId,
    name: scenes.name,
    position: scenes.position,
    createdAt: scenes.createdAt,
    updatedAt: scenes.updatedAt,
    imageCount: sql<number>`(SELECT count(*) FROM images WHERE images.scene_id = scenes.id)`,
    queueCount: sql<number>`(
        SELECT count(*) FROM jobs
        WHERE jobs.scene_id = scenes.id AND jobs.status IN ('queued', 'running')
    )`,
    latestImages: sql<string>`(
        SELECT json_group_array(json_object(
            'id', i.id, 'variationId', i.variation_id, 'position', i.position, 'assetId', i.asset_id,
            'thumbAssetId', i.thumb_asset_id, 'createdAt', i.created_at
        ))
        FROM (
            SELECT * FROM images WHERE images.scene_id = scenes.id
            ORDER BY position, id LIMIT ${LATEST_IMAGE_COUNT}
        ) i
    )`,
}

export type SceneSummaryRow = {
    id: number
    projectId: number
    name: string
    position: string
    createdAt: Date
    updatedAt: Date
    imageCount: number
    queueCount: number
    latestImages: string
}

export function listSummaries(db: DbOrTx, projectId: number): SceneSummaryRow[] {
    return db
        .select(summaryColumns)
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(asc(scenes.position), asc(scenes.id))
        .all()
}

export function getSummary(db: DbOrTx, id: number): SceneSummaryRow | null {
    return db.select(summaryColumns).from(scenes).where(eq(scenes.id, id)).get() ?? null
}

export function listByProject(db: DbOrTx, projectId: number) {
    return db
        .select()
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(asc(scenes.position), asc(scenes.id))
        .all()
}

export function getById(db: DbOrTx, id: number) {
    return db.select().from(scenes).where(eq(scenes.id, id)).get() ?? null
}

export function lastPosition(db: DbOrTx, projectId: number) {
    return (
        db
            .select({ position: scenes.position })
            .from(scenes)
            .where(eq(scenes.projectId, projectId))
            .orderBy(desc(scenes.position), desc(scenes.id))
            .limit(1)
            .get()?.position ?? null
    )
}

export function insert(db: DbOrTx, values: typeof scenes.$inferInsert) {
    return db.insert(scenes).values(values).returning().get()
}

export function update(db: DbOrTx, id: number, values: Partial<typeof scenes.$inferInsert>) {
    return db.update(scenes).set(values).where(eq(scenes.id, id)).returning().get() ?? null
}

export function setPosition(db: DbOrTx, id: number, position: string) {
    db.update(scenes).set({ position }).where(eq(scenes.id, id)).run()
}

export function remove(db: DbOrTx, ids: number[]) {
    if (ids.length === 0) return
    db.delete(scenes).where(inArray(scenes.id, ids)).run()
}

export function imageAssetIds(db: DbOrTx, sceneIds: number[]) {
    if (sceneIds.length === 0) return []
    const ids = sql.join(
        sceneIds.map((id) => sql`${id}`),
        sql`, `,
    )
    return db
        .all<{ id: number }>(sql`
            SELECT asset_id AS id FROM images WHERE scene_id IN (${ids})
            UNION ALL SELECT thumb_asset_id FROM images WHERE scene_id IN (${ids})
        `)
        .map((row) => row.id)
}

export function variationsByScene(db: DbOrTx, sceneIds: number[]) {
    if (sceneIds.length === 0) return []
    return db
        .select()
        .from(sceneVariations)
        .where(inArray(sceneVariations.sceneId, sceneIds))
        .orderBy(
            asc(sceneVariations.sceneId),
            asc(sceneVariations.position),
            asc(sceneVariations.id),
        )
        .all()
}

export function getVariation(db: DbOrTx, id: number) {
    return db.select().from(sceneVariations).where(eq(sceneVariations.id, id)).get() ?? null
}

export function getVariationsByIds(db: DbOrTx, ids: number[]) {
    if (ids.length === 0) return []
    return db.select().from(sceneVariations).where(inArray(sceneVariations.id, ids)).all()
}

export function insertVariations(db: DbOrTx, values: (typeof sceneVariations.$inferInsert)[]) {
    if (values.length === 0) return []
    return db.insert(sceneVariations).values(values).returning().all()
}

export function updateVariation(
    db: DbOrTx,
    sceneId: number,
    id: number,
    values: Pick<typeof sceneVariations.$inferInsert, 'variables' | 'position'>,
) {
    db.update(sceneVariations)
        .set(values)
        .where(and(eq(sceneVariations.id, id), eq(sceneVariations.sceneId, sceneId)))
        .run()
}

export function deleteVariations(db: DbOrTx, ids: number[]) {
    if (ids.length === 0) return
    db.delete(sceneVariations).where(inArray(sceneVariations.id, ids)).run()
}

export function touch(db: DbOrTx, id: number) {
    db.update(scenes).set({ updatedAt: new Date() }).where(eq(scenes.id, id)).run()
}
