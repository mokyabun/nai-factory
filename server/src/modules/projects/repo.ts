import { asc, eq, isNull, sql } from 'drizzle-orm'

import { type DbOrTx, projects } from '@/db'

export type ProjectRow = typeof projects.$inferSelect
export type ProjectInsert = typeof projects.$inferInsert

export function list(db: DbOrTx, groupId?: number | 'none') {
    return db
        .select()
        .from(projects)
        .where(
            groupId === undefined
                ? undefined
                : groupId === 'none'
                  ? isNull(projects.groupId)
                  : eq(projects.groupId, groupId),
        )
        .orderBy(asc(projects.name), asc(projects.id))
        .all()
}

export function getById(db: DbOrTx, id: number) {
    return db.select().from(projects).where(eq(projects.id, id)).get() ?? null
}

export function exists(db: DbOrTx, id: number) {
    return !!db.select({ id: projects.id }).from(projects).where(eq(projects.id, id)).get()
}

export function insert(db: DbOrTx, values: ProjectInsert) {
    return db.insert(projects).values(values).returning().get()
}

export function update(db: DbOrTx, id: number, values: Partial<ProjectInsert>) {
    return db.update(projects).set(values).where(eq(projects.id, id)).returning().get() ?? null
}

export function remove(db: DbOrTx, id: number) {
    db.delete(projects).where(eq(projects.id, id)).run()
}

/** Every asset owned by the projects' images and references. */
export function assetIds(db: DbOrTx, projectIds: number[]) {
    if (projectIds.length === 0) return []
    const ids = sql.join(
        projectIds.map((id) => sql`${id}`),
        sql`, `,
    )
    const rows = db.all<{ id: number | null }>(sql`
        SELECT i.asset_id AS id FROM images i JOIN scenes s ON s.id = i.scene_id WHERE s.project_id IN (${ids})
        UNION ALL SELECT i.thumb_asset_id FROM images i JOIN scenes s ON s.id = i.scene_id WHERE s.project_id IN (${ids})
        UNION ALL SELECT source_asset_id FROM vibe_transfers WHERE project_id IN (${ids})
        UNION ALL SELECT encoded_asset_id FROM vibe_transfers WHERE project_id IN (${ids})
        UNION ALL SELECT source_asset_id FROM character_references WHERE project_id IN (${ids})
        UNION ALL SELECT thumb_asset_id FROM character_references WHERE project_id IN (${ids})
        UNION ALL SELECT processed_asset_id FROM character_references WHERE project_id IN (${ids})
    `)
    return rows.map((row) => row.id).filter((id): id is number => id !== null)
}
