import type { JobStatus } from '@nai-factory/shared'
import { and, asc, count, desc, eq, inArray, notInArray, sql } from 'drizzle-orm'

import { type DbOrTx, jobs, scenes } from '@/db'

export type JobRow = typeof jobs.$inferSelect
export type JobInsert = typeof jobs.$inferInsert
export type JobWithLabel = JobRow & { sceneName: string | null }

export const FINISHED_STATUSES: JobStatus[] = ['completed', 'failed', 'cancelled']

const withLabel = { job: jobs, sceneName: scenes.name }

function flatten(row: { job: JobRow; sceneName: string | null }): JobWithLabel {
    return { ...row.job, sceneName: row.sceneName }
}

export function getById(db: DbOrTx, id: number) {
    return db.select().from(jobs).where(eq(jobs.id, id)).get() ?? null
}

export function getWithLabel(db: DbOrTx, id: number) {
    const row = db
        .select(withLabel)
        .from(jobs)
        .leftJoin(scenes, eq(jobs.sceneId, scenes.id))
        .where(eq(jobs.id, id))
        .get()
    return row ? flatten(row) : null
}

export function list(db: DbOrTx, statuses: JobStatus[], projectId?: number) {
    return db
        .select(withLabel)
        .from(jobs)
        .leftJoin(scenes, eq(jobs.sceneId, scenes.id))
        .where(
            and(
                inArray(jobs.status, statuses),
                projectId === undefined ? undefined : eq(jobs.projectId, projectId),
            ),
        )
        .orderBy(
            // The running job first, then the queue order.
            sql`CASE ${jobs.status} WHEN 'running' THEN 0 ELSE 1 END`,
            asc(jobs.priorityKey),
            asc(jobs.id),
        )
        .all()
        .map(flatten)
}

export function history(db: DbOrTx, limit: number) {
    return db
        .select(withLabel)
        .from(jobs)
        .leftJoin(scenes, eq(jobs.sceneId, scenes.id))
        .where(inArray(jobs.status, FINISHED_STATUSES))
        .orderBy(desc(jobs.finishedAt), desc(jobs.id))
        .limit(limit)
        .all()
        .map(flatten)
}

export function queued(db: DbOrTx) {
    return db
        .select()
        .from(jobs)
        .where(eq(jobs.status, 'queued'))
        .orderBy(asc(jobs.priorityKey), asc(jobs.id))
        .all()
}

export function nextQueued(db: DbOrTx) {
    return (
        db
            .select()
            .from(jobs)
            .where(eq(jobs.status, 'queued'))
            .orderBy(asc(jobs.priorityKey), asc(jobs.id))
            .limit(1)
            .get() ?? null
    )
}

/** First and last priority keys among queued jobs. */
export function queueBounds(db: DbOrTx) {
    const row = db
        .select({
            first: sql<string | null>`min(${jobs.priorityKey})`,
            last: sql<string | null>`max(${jobs.priorityKey})`,
        })
        .from(jobs)
        .where(eq(jobs.status, 'queued'))
        .get()
    return { first: row?.first ?? null, last: row?.last ?? null }
}

export function insertMany(db: DbOrTx, values: JobInsert[]) {
    if (values.length === 0) return []
    return db.insert(jobs).values(values).returning({ id: jobs.id }).all()
}

export function update(db: DbOrTx, id: number, values: Partial<JobInsert>) {
    return db.update(jobs).set(values).where(eq(jobs.id, id)).returning().get() ?? null
}

export function remove(db: DbOrTx, ids: number[]) {
    if (ids.length === 0) return
    db.delete(jobs).where(inArray(jobs.id, ids)).run()
}

export function queuedMatching(db: DbOrTx, filter: { sceneId?: number; variationId?: number }) {
    return db
        .select({ id: jobs.id })
        .from(jobs)
        .where(
            and(
                eq(jobs.status, 'queued'),
                filter.sceneId === undefined ? undefined : eq(jobs.sceneId, filter.sceneId),
                filter.variationId === undefined
                    ? undefined
                    : eq(jobs.variationId, filter.variationId),
            ),
        )
        .all()
        .map((row) => row.id)
}

/** Jobs left `running` by a crash go back to the queue; generated images are kept. */
export function requeueRunning(db: DbOrTx) {
    return db
        .update(jobs)
        .set({ status: 'queued' })
        .where(eq(jobs.status, 'running'))
        .returning({ id: jobs.id })
        .all().length
}

export function pendingCounts(db: DbOrTx) {
    const rows = db
        .select({ kind: jobs.kind, count: count() })
        .from(jobs)
        .where(inArray(jobs.status, ['queued', 'running']))
        .groupBy(jobs.kind)
        .all()
    return {
        scene: rows.find((row) => row.kind === 'scene')?.count ?? 0,
        playground: rows.find((row) => row.kind === 'playground')?.count ?? 0,
    }
}

export function finishedCounts(db: DbOrTx) {
    const rows = db
        .select({ status: jobs.status, count: count() })
        .from(jobs)
        .where(inArray(jobs.status, ['completed', 'failed']))
        .groupBy(jobs.status)
        .all()
    return {
        completed: rows.find((row) => row.status === 'completed')?.count ?? 0,
        failed: rows.find((row) => row.status === 'failed')?.count ?? 0,
    }
}

/** Keeps the newest `keep` completed or cancelled jobs. Failed jobs stay until retried. */
export function trimHistory(db: DbOrTx, keep: number) {
    const kept = db
        .select({ id: jobs.id })
        .from(jobs)
        .where(inArray(jobs.status, ['completed', 'cancelled']))
        .orderBy(desc(jobs.finishedAt), desc(jobs.id))
        .limit(keep)
        .all()
        .map((row) => row.id)
    db.delete(jobs)
        .where(
            and(
                inArray(jobs.status, ['completed', 'cancelled']),
                kept.length > 0 ? notInArray(jobs.id, kept) : undefined,
            ),
        )
        .run()
}
