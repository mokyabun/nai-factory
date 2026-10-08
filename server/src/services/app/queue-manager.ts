import type {
    QueueHistoryEntry,
    QueueJobType,
    QueuePauseReason,
    QueueStatus,
} from '@nai-factory/shared'
import { asc, count, eq, inArray, max, min } from 'drizzle-orm'

import { db, playgroundQueueItems, queueItems, scenes, sceneVariations } from '@/db'
import logger from '@/logger'

import { realtimeEvents } from './events'
import { PromptRenderError } from './prompt'
import { type JobProgress, runJob, runPlaygroundJob } from './queue-runner'
import { deriveQueueState, estimateRemainingMs, RollingSamples } from './queue-status'

export type EnqueuePosition = 'back' | 'front'

const DURATION_BUFFER_SIZE = 100
const HISTORY_BUFFER_SIZE = 100

type PendingQueueJob = {
    id: number
    type: QueueJobType
    projectId: number | null
    sceneId: number | null
    sceneVariationId: number | null
    sceneName: string
    prompt: string | null
    sortIndex: number
}

type CurrentJob = PendingQueueJob & {
    startedAt: string
    startedAtMs: number
    imageCount: number | null
    savedImageCount: number
    imageStartedAtMs: number | null
}

type PlaygroundJobDraft = {
    prompt: string
    negativePrompt: string
    parameters: typeof playgroundQueueItems.$inferInsert.parameters
}

function publishQueueChanged() {
    realtimeEvents.publish({ type: 'queue.changed' })
}

function failureCategory(error: unknown) {
    if (error instanceof PromptRenderError) return error.category
    if (error instanceof Error && /api key/i.test(error.message)) return 'configuration'
    if (error instanceof Error && /NovelAI|fetch|HTTP|network|timeout/i.test(error.message)) {
        return 'network'
    }
    return 'runtime'
}

class QueueManager {
    private readonly log = logger.child({ module: 'queue' })
    private readonly imageDurations = new RollingSamples(DURATION_BUFFER_SIZE)
    private readonly jobDurations: Record<QueueJobType, RollingSamples> = {
        scene: new RollingSamples(DURATION_BUFFER_SIZE),
        playground: new RollingSamples(DURATION_BUFFER_SIZE),
    }
    private readonly recentHistory: QueueHistoryEntry[] = []

    private processing = false
    private running = false
    private pauseReason: QueuePauseReason | null = null
    private currentJob: CurrentJob | null = null
    private nextHistoryId = 1
    private completedCount = 0
    private failedCount = 0

    async add(sceneId: number, position: EnqueuePosition = 'back', sceneVariationId?: number) {
        const [scene] = await db
            .select({ projectId: scenes.projectId })
            .from(scenes)
            .where(eq(scenes.id, sceneId))
        if (!scene) throw new Error(`Scene ${sceneId} not found`)

        const variations = await db
            .select({ id: sceneVariations.id, sceneId: sceneVariations.sceneId })
            .from(sceneVariations)
            .where(
                sceneVariationId
                    ? eq(sceneVariations.id, sceneVariationId)
                    : eq(sceneVariations.sceneId, sceneId),
            )
            .orderBy(asc(sceneVariations.displayOrder))

        if (sceneVariationId && variations[0]?.sceneId !== sceneId) {
            throw new Error(`Scene variation ${sceneVariationId} not found`)
        }
        if (variations.length === 0) return []

        const baseSortIndex = await this.nextSortIndex(position, variations.length)
        const items = await db
            .insert(queueItems)
            .values(
                variations.map((variation, index) => ({
                    projectId: scene.projectId,
                    sceneId,
                    sceneVariationId: variation.id,
                    sortIndex: baseSortIndex + index,
                })),
            )
            .returning()
        if (items.length !== variations.length) throw new Error('Failed to create queue items')

        this.log.debug(
            {
                projectId: scene.projectId,
                sceneId,
                sceneVariationId,
                position,
                count: items.length,
            },
            'Job enqueued',
        )

        if (this.running && !this.processing) void this.processQueue()

        return items
    }

    async addPlayground(draft: PlaygroundJobDraft, position: EnqueuePosition = 'back') {
        const sortIndex = await this.nextSortIndex(position, 1)
        const [item] = await db
            .insert(playgroundQueueItems)
            .values({
                prompt: draft.prompt,
                negativePrompt: draft.negativePrompt,
                parameters: draft.parameters,
                sortIndex,
            })
            .returning()

        if (!item) throw new Error('Failed to create playground queue item')

        this.log.debug({ position, jobId: item.id }, 'Playground job enqueued')

        if (this.running && !this.processing) void this.processQueue()

        return item
    }

    start() {
        if (this.running) {
            this.log.debug('Queue start ignored because queue is already running')
            return
        }

        this.running = true
        this.pauseReason = null
        this.log.info({ event: 'queue.started' }, 'Queue started')
        publishQueueChanged()

        if (!this.processing) void this.processQueue()
    }

    stop() {
        if (!this.running) {
            this.log.debug('Queue stop ignored because queue is not running')
            return
        }

        // The running job is not interrupted; the processor halts once it finishes.
        this.running = false
        this.pauseReason = 'user'
        this.log.info({ event: 'queue.stopped' }, 'Queue stopped')
        publishQueueChanged()
    }

    async cancel(jobIds: number[]) {
        if (jobIds.length === 0) return

        await db.delete(queueItems).where(inArray(queueItems.id, jobIds))
        this.log.debug({ jobIds }, 'Jobs cancelled')
    }

    async status(): Promise<QueueStatus> {
        const counts = await this.fetchQueueStats()
        const pendingCount = counts.scene + counts.playground
        const now = Date.now()
        const current = this.currentJob
        const avgImageMs = this.imageDurations.average()
        const state = deriveQueueState({
            running: this.running,
            processing: this.processing,
            pendingCount,
        })
        // A drained queue forgets why it last paused, so newly queued jobs do not inherit it.
        if (state === 'idle') this.pauseReason = null

        const remainingMs =
            pendingCount > 0 || current
                ? estimateRemainingMs({
                      now,
                      waiting: {
                          // The running job keeps its row until it completes.
                          scene: Math.max(0, counts.scene - (current?.type === 'scene' ? 1 : 0)),
                          playground: Math.max(
                              0,
                              counts.playground - (current?.type === 'playground' ? 1 : 0),
                          ),
                      },
                      avgImageMs,
                      avgJobMs: {
                          scene: this.jobDurations.scene.average(),
                          playground: this.jobDurations.playground.average(),
                      },
                      current,
                  })
                : null

        return {
            state,
            pauseReason: state === 'paused' || state === 'pausing' ? this.pauseReason : null,
            running: this.running,
            processing: this.processing,
            pendingCount,
            estimatedSeconds: remainingMs !== null ? Math.round(remainingMs / 1000) : null,
            currentSceneId: current?.sceneId ?? null,
            currentJob: current
                ? {
                      id: current.id,
                      type: current.type,
                      projectId: current.projectId,
                      sceneId: current.sceneId,
                      sceneVariationId: current.sceneVariationId,
                      sceneName: current.sceneName,
                      prompt: current.prompt,
                      startedAt: current.startedAt,
                      imageCount: current.imageCount,
                      savedImageCount: current.savedImageCount,
                      imageStartedAt:
                          current.imageStartedAtMs !== null
                              ? new Date(current.imageStartedAtMs).toISOString()
                              : null,
                  }
                : null,
            avgDurationMs: avgImageMs,
            durationSampleSize: this.imageDurations.size,
            completedCount: this.completedCount,
            failedCount: this.failedCount,
            recent: this.recentHistory,
            serverTime: new Date(now).toISOString(),
        }
    }

    private async fetchQueueStats() {
        const [sceneRow, playgroundRow] = await Promise.all([
            db
                .select({ jobCount: count() })
                .from(queueItems)
                .then((rows) => rows[0]),
            db
                .select({ jobCount: count() })
                .from(playgroundQueueItems)
                .then((rows) => rows[0]),
        ])

        return { scene: sceneRow?.jobCount ?? 0, playground: playgroundRow?.jobCount ?? 0 }
    }

    private async nextSortIndex(position: EnqueuePosition, count: number) {
        const [sceneRow, playgroundRow] = await Promise.all([
            db
                .select({
                    minSortIndex: min(queueItems.sortIndex),
                    maxSortIndex: max(queueItems.sortIndex),
                })
                .from(queueItems)
                .then((rows) => rows[0]),
            db
                .select({
                    minSortIndex: min(playgroundQueueItems.sortIndex),
                    maxSortIndex: max(playgroundQueueItems.sortIndex),
                })
                .from(playgroundQueueItems)
                .then((rows) => rows[0]),
        ])

        const minSortIndex = Math.min(sceneRow?.minSortIndex ?? 0, playgroundRow?.minSortIndex ?? 0)
        const maxSortIndex = Math.max(sceneRow?.maxSortIndex ?? 0, playgroundRow?.maxSortIndex ?? 0)

        if (position === 'front') return minSortIndex - count

        return maxSortIndex + 1
    }

    private async processQueue(): Promise<void> {
        if (this.processing) return
        this.processing = true
        this.log.debug('Queue processor entered')

        while (this.running) {
            const next = await this.fetchNextJob()
            if (!next) {
                this.log.debug('Queue processor found no pending jobs')
                break
            }

            await this.runCurrentJob(next)
        }

        this.running = false
        this.processing = false
        this.log.info({ event: 'queue.finished' }, 'Queue finished')
        publishQueueChanged()
    }

    private async fetchNextJob(): Promise<PendingQueueJob | null> {
        // Equal sort indexes can resolve in either table order; both queues share one priority lane.
        const [nextScene, nextPlayground] = await Promise.all([
            db
                .select({
                    id: queueItems.id,
                    projectId: queueItems.projectId,
                    sceneId: queueItems.sceneId,
                    sceneVariationId: queueItems.sceneVariationId,
                    sceneName: scenes.name,
                    sortIndex: queueItems.sortIndex,
                })
                .from(queueItems)
                .innerJoin(scenes, eq(queueItems.sceneId, scenes.id))
                .orderBy(asc(queueItems.sortIndex))
                .limit(1)
                .then((rows) =>
                    rows[0]
                        ? {
                              ...rows[0],
                              type: 'scene' as const,
                              prompt: null,
                          }
                        : null,
                ),
            db
                .select({
                    id: playgroundQueueItems.id,
                    prompt: playgroundQueueItems.prompt,
                    sortIndex: playgroundQueueItems.sortIndex,
                })
                .from(playgroundQueueItems)
                .orderBy(asc(playgroundQueueItems.sortIndex))
                .limit(1)
                .then((rows) =>
                    rows[0]
                        ? {
                              ...rows[0],
                              type: 'playground' as const,
                              projectId: null,
                              sceneId: null,
                              sceneVariationId: null,
                              sceneName: 'Playground',
                          }
                        : null,
                ),
        ])

        if (!nextScene) return nextPlayground
        if (!nextPlayground) return nextScene

        return nextScene.sortIndex <= nextPlayground.sortIndex ? nextScene : nextPlayground
    }

    private async runCurrentJob(job: PendingQueueJob): Promise<void> {
        const startedAtMs = Date.now()
        const startedAt = new Date(startedAtMs).toISOString()
        this.currentJob = {
            ...job,
            startedAt,
            startedAtMs,
            imageCount: null,
            savedImageCount: 0,
            imageStartedAtMs: null,
        }
        publishQueueChanged()
        this.log.info(
            {
                event: 'queue.job.started',
                jobId: job.id,
                type: job.type,
                projectId: job.projectId,
                sceneId: job.sceneId,
                sceneVariationId: job.sceneVariationId,
            },
            'Queue job started',
        )

        try {
            const runner = job.type === 'playground' ? runPlaygroundJob(job.id) : runJob(job.id)
            for await (const progress of runner) this.applyProgress(progress)
            this.recordCompletedJob(job, startedAt, Date.now() - startedAtMs)
        } catch (error) {
            this.recordFailedJob(job, startedAt, Date.now() - startedAtMs, error)
            this.running = false
            this.pauseReason = 'failure'
        } finally {
            this.currentJob = null
            publishQueueChanged()
        }
    }

    private applyProgress(progress: JobProgress) {
        const current = this.currentJob
        if (!current) return

        switch (progress.type) {
            case 'planned':
                current.imageCount = progress.imageCount
                break
            case 'image.started':
                current.imageStartedAtMs = Date.now()
                break
            case 'image.saved':
                current.savedImageCount += 1
                current.imageStartedAtMs = null
                this.imageDurations.push(progress.durationMs)
                break
        }

        publishQueueChanged()
    }

    private recordCompletedJob(job: PendingQueueJob, startedAt: string, durationMs: number) {
        this.completedCount += 1
        this.jobDurations[job.type].push(durationMs)
        this.recordHistory({
            jobId: job.id,
            type: job.type,
            projectId: job.projectId,
            sceneId: job.sceneId,
            sceneVariationId: job.sceneVariationId,
            sceneName: job.sceneName,
            prompt: job.prompt,
            status: 'completed',
            startedAt,
            durationMs,
            error: null,
            failureCategory: null,
        })
        this.log.info(
            { event: 'queue.job.completed', jobId: job.id, type: job.type, durationMs },
            'Queue job completed',
        )
    }

    private recordFailedJob(
        job: PendingQueueJob,
        startedAt: string,
        durationMs: number,
        error: unknown,
    ) {
        this.log.error(
            {
                event: 'queue.job.failed',
                jobId: job.id,
                type: job.type,
                projectId: job.projectId,
                sceneId: job.sceneId,
                sceneVariationId: job.sceneVariationId,
                durationMs,
                err: error,
            },
            'Job failed — stopping queue',
        )
        this.failedCount += 1
        this.recordHistory({
            jobId: job.id,
            type: job.type,
            projectId: job.projectId,
            sceneId: job.sceneId,
            sceneVariationId: job.sceneVariationId,
            sceneName: job.sceneName,
            prompt: job.prompt,
            status: 'failed',
            startedAt,
            durationMs,
            error: error instanceof Error ? error.message : String(error),
            failureCategory: failureCategory(error),
        })
    }

    private recordHistory(entry: Omit<QueueHistoryEntry, 'id' | 'completedAt'>) {
        this.recentHistory.unshift({
            id: this.nextHistoryId++,
            completedAt: new Date().toISOString(),
            ...entry,
        })

        if (this.recentHistory.length > HISTORY_BUFFER_SIZE) this.recentHistory.pop()
    }
}

export const queueManager = new QueueManager()
