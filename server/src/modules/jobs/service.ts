import type {
    EnqueueResult,
    Job,
    JobClearQuery,
    JobStatus,
    MoveBody,
    PlaygroundEnqueueBody,
    QueueStatus,
    SceneEnqueueBody,
} from '@nai-factory/shared'

import type { AppContext } from '@/context'
import type { DbOrTx } from '@/db'
import { badRequest, conflict, notFound, requireEntity } from '@/lib/http'
import { keysBetween, planMove } from '@/lib/order'
import { toIso } from '@/lib/time'
import * as playground from '@/modules/playground/service'
import * as projects from '@/modules/projects/service'
import * as scenes from '@/modules/scenes/service'

import * as repo from './repo'

const DEFAULT_LIST_STATUSES: JobStatus[] = ['queued', 'running']
const DEFAULT_HISTORY_LIMIT = 100
const PLAYGROUND_LABEL = 'Playground'

export function toEntity(row: repo.JobWithLabel): Job {
    return {
        id: row.id,
        kind: row.kind,
        status: row.status,
        position: row.priorityKey,
        projectId: row.projectId,
        sceneId: row.sceneId,
        variationId: row.variationId,
        label: row.kind === 'playground' ? PLAYGROUND_LABEL : (row.sceneName ?? ''),
        prompt: row.payload?.prompt ?? null,
        totalImages: row.totalImages,
        doneImages: row.doneImages,
        error: row.error,
        errorKind: row.errorKind,
        createdAt: toIso(row.createdAt),
        startedAt: toIso(row.startedAt),
        finishedAt: toIso(row.finishedAt),
    }
}

export function list(ctx: AppContext, statuses = DEFAULT_LIST_STATUSES, projectId?: number) {
    return repo.list(ctx.db, statuses, projectId).map(toEntity)
}

export function history(ctx: AppContext, limit = DEFAULT_HISTORY_LIMIT) {
    return repo.history(ctx.db, limit).map(toEntity)
}

type SceneTarget = { projectId: number; sceneId: number; variationId: number }

/** Resolves an enqueue request into (scene, variation) pairs in queue order. */
function resolveTargets(tx: DbOrTx, body: SceneEnqueueBody): SceneTarget[] {
    if (body.variationIds) {
        const rows = scenes.variationRowsByIds(tx, body.variationIds)
        const byId = new Map(rows.map((row) => [row.id, row]))
        return body.variationIds.map((id) => {
            const variation = byId.get(id)
            if (!variation) throw notFound(`Variation ${id}`)
            const scene = scenes.requireRow(tx, variation.sceneId)
            return { projectId: scene.projectId, sceneId: scene.id, variationId: id }
        })
    }

    const sceneRows = body.sceneIds
        ? body.sceneIds.map((id) => scenes.requireRow(tx, id))
        : (() => {
              projects.assertExists(tx, body.projectId as number)
              return scenes.sceneRows(tx, body.projectId as number)
          })()

    const variations = scenes.variationRows(
        tx,
        sceneRows.map((scene) => scene.id),
    )
    return sceneRows.flatMap((scene) =>
        variations
            .filter((variation) => variation.sceneId === scene.id)
            .map((variation) => ({
                projectId: scene.projectId,
                sceneId: scene.id,
                variationId: variation.id,
            })),
    )
}

function priorityKeys(tx: DbOrTx, position: 'front' | 'back', count: number) {
    const bounds = repo.queueBounds(tx)
    return position === 'front'
        ? keysBetween(null, bounds.first, count)
        : keysBetween(bounds.last, null, count)
}

function afterEnqueue(ctx: AppContext, jobIds: number[]): EnqueueResult {
    ctx.events.publish({ type: 'jobs.changed' })
    ctx.scheduler.wake()
    return { queued: jobIds.length, jobIds }
}

export function enqueueScenes(ctx: AppContext, body: SceneEnqueueBody) {
    const ids = ctx.db.transaction((tx) => {
        const targets = resolveTargets(tx, body)
        const keys = priorityKeys(tx, body.position ?? 'back', targets.length)
        return repo
            .insertMany(
                tx,
                targets.map((target, index) => ({
                    kind: 'scene' as const,
                    status: 'queued' as const,
                    priorityKey: keys[index] as string,
                    repeatCount: body.count ?? 1,
                    ...target,
                })),
            )
            .map((row) => row.id)
    })
    return afterEnqueue(ctx, ids)
}

export function enqueuePlayground(ctx: AppContext, body: PlaygroundEnqueueBody) {
    const { position, ...overrides } = body
    const ids = ctx.db.transaction((tx) => {
        const snapshot = playground.mergeSnapshot(playground.getState(ctx), overrides)
        if (!snapshot.prompt.trim()) throw badRequest('The playground prompt is empty')
        const [key] = priorityKeys(tx, position ?? 'back', 1)
        return repo
            .insertMany(tx, [
                {
                    kind: 'playground',
                    status: 'queued',
                    priorityKey: key as string,
                    payload: snapshot,
                },
            ])
            .map((row) => row.id)
    })
    return afterEnqueue(ctx, ids)
}

export function move(ctx: AppContext, id: number, body: MoveBody) {
    const job = ctx.db.transaction((tx) => {
        const row = requireEntity(repo.getById(tx, id), 'Job')
        if (row.status !== 'queued') throw conflict('Only queued jobs can be moved')
        const siblings = repo.queued(tx).map((job) => ({ id: job.id, position: job.priorityKey }))
        let updates
        try {
            updates = planMove(siblings, id, body.beforeId, body.afterId)
        } catch (error) {
            throw scenes.moveError(error, 'Job')
        }
        for (const update of updates) repo.update(tx, update.id, { priorityKey: update.position })
        return requireEntity(repo.getWithLabel(tx, id), 'Job')
    })
    ctx.events.publish({ type: 'jobs.changed' })
    return toEntity(job)
}

/** Requeues a failed or cancelled job; it resumes after the images it already saved. */
export function retry(ctx: AppContext, id: number) {
    const job = ctx.db.transaction((tx) => {
        const row = requireEntity(repo.getById(tx, id), 'Job')
        if (row.status !== 'failed' && row.status !== 'cancelled') {
            throw conflict('Only failed or cancelled jobs can be retried')
        }
        repo.update(tx, id, { status: 'queued', error: null, errorKind: null, finishedAt: null })
        return requireEntity(repo.getWithLabel(tx, id), 'Job')
    })
    ctx.events.publish({ type: 'jobs.changed' })
    ctx.scheduler.wake()
    return toEntity(job)
}

/** Deletes a job, or cancels it when it is running. */
export function remove(ctx: AppContext, id: number) {
    const row = requireEntity(repo.getById(ctx.db, id), 'Job')
    if (row.status === 'running' && ctx.scheduler.cancel(id)) return
    repo.remove(ctx.db, [id])
    ctx.events.publish({ type: 'jobs.changed' })
}

export function clear(ctx: AppContext, filter: JobClearQuery) {
    const ids = repo.queuedMatching(ctx.db, filter)
    repo.remove(ctx.db, ids)

    let cancelled = ids.length
    const current = ctx.scheduler.current()
    if (current) {
        const running = repo.getById(ctx.db, current.jobId)
        const matches =
            running &&
            (filter.sceneId === undefined || running.sceneId === filter.sceneId) &&
            (filter.variationId === undefined || running.variationId === filter.variationId)
        if (matches && ctx.scheduler.cancel(current.jobId)) cancelled += 1
    }

    ctx.events.publish({ type: 'jobs.changed' })
    return { cancelled }
}

export function status(ctx: AppContext): QueueStatus {
    const now = Date.now()
    const pending = repo.pendingCounts(ctx.db)
    const pendingCount = pending.scene + pending.playground
    const { running, processing, pauseReason } = ctx.scheduler.state()
    const state =
        processing || pendingCount > 0
            ? processing
                ? running
                    ? 'running'
                    : 'pausing'
                : 'paused'
            : 'idle'
    const current = ctx.scheduler.current()
    const currentRow = current ? repo.getWithLabel(ctx.db, current.jobId) : null
    const counts = repo.finishedCounts(ctx.db)
    const { avgImageMs, sampleSize } = ctx.scheduler.samples()

    const waiting = {
        scene: Math.max(0, pending.scene - (current?.kind === 'scene' ? 1 : 0)),
        playground: Math.max(0, pending.playground - (current?.kind === 'playground' ? 1 : 0)),
    }
    const remainingMs = pendingCount > 0 || current ? ctx.scheduler.estimate(now, waiting) : null

    return {
        state,
        pauseReason: state === 'paused' || state === 'pausing' ? pauseReason : null,
        pendingCount,
        estimatedSeconds: remainingMs === null ? null : Math.round(remainingMs / 1000),
        current:
            current && currentRow
                ? {
                      jobId: current.jobId,
                      kind: current.kind,
                      projectId: currentRow.projectId,
                      sceneId: currentRow.sceneId,
                      variationId: currentRow.variationId,
                      label: toEntity(currentRow).label,
                      prompt: currentRow.payload?.prompt ?? null,
                      startedAt: current.startedAt.toISOString(),
                      total: current.total,
                      done: current.done,
                      imageStartedAt: current.imageStartedAt?.toISOString() ?? null,
                  }
                : null,
        avgImageMs,
        sampleSize,
        completedCount: counts.completed,
        failedCount: counts.failed,
        serverTime: new Date(now).toISOString(),
    }
}
