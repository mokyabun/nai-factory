import { asc, eq, inArray } from 'drizzle-orm'

import { type DbOrTx, groups, projects } from '@/db'

export type GroupRow = typeof groups.$inferSelect

export function list(db: DbOrTx) {
    return db.select().from(groups).orderBy(asc(groups.name), asc(groups.id)).all()
}

export function getById(db: DbOrTx, id: number) {
    return db.select().from(groups).where(eq(groups.id, id)).get() ?? null
}

export function insert(db: DbOrTx, values: { parentId: number | null; name: string }) {
    return db.insert(groups).values(values).returning().get()
}

export function update(
    db: DbOrTx,
    id: number,
    values: Partial<Pick<GroupRow, 'parentId' | 'name'>>,
) {
    return db.update(groups).set(values).where(eq(groups.id, id)).returning().get() ?? null
}

export function remove(db: DbOrTx, id: number) {
    db.delete(groups).where(eq(groups.id, id)).run()
}

export function projectSummaries(db: DbOrTx) {
    return db
        .select({ id: projects.id, groupId: projects.groupId, name: projects.name })
        .from(projects)
        .orderBy(asc(projects.name), asc(projects.id))
        .all()
}

export function projectIdsInGroups(db: DbOrTx, groupIds: number[]) {
    if (groupIds.length === 0) return []
    return db
        .select({ id: projects.id })
        .from(projects)
        .where(inArray(projects.groupId, groupIds))
        .all()
        .map((row) => row.id)
}
