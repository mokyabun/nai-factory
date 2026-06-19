import { asc, count, eq, inArray, max, min } from 'drizzle-orm'
import { db, playgroundQueueItems, queueItems, scenes, sceneVariations } from '@/db'
import logger from '@/logger'
import { realtimeEvents } from './events'
import { PromptRenderError } from './prompt'
import { runJob, runPlaygroundJob } from './queue-runner'

export type EnqueuePosition = 'back' | 'front'

const DURATION_BUFFER_SIZE = 100
const HISTORY_BUFFER_SIZE = 100

type QueueHistoryEntry = {
    id: number
    jobId: number
    type: 'scene' | 'playground'
    projectId: number | null
    sceneId: number | null
    sceneVariationId: number | null
    sceneName: string
    prompt: string | null
    status: 'completed' | 'failed'
    startedAt: string
    durationMs: number
    completedAt: string
    error: string | null
    failureCategory: string | null
}

type CurrentJob = {
    id: number
    type: 'scene' | 'playground'
    projectId: number | null
    sceneId: number | null
    sceneVariationId: number | null
    sceneName: string
    prompt: string | null
    startedAt: string
    startedAtMs: number
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
    private readonly recentDurations: number[] = []
    private readonly recentHistory: QueueHistoryEntry[] = []

    private processing = false
    private running = false
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

        if (this.running && !this.processing) this.processQueue()

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

        if (this.running && !this.processing) this.processQueue()

        return item
    }

    start() {
        if (this.running) {
            this.log.debug('Queue start ignored because queue is already running')
            return
        }

        this.running = true
        this.log.info('Queue started')

        if (!this.processing) this.processQueue()
    }

    stop() {
        if (!this.running) {
            this.log.debug('Queue stop ignored because queue is not running')
            return
        }

        this.running = false
        this.log.info('Queue stopped')
    }

    async cancel(jobIds: number[]) {
        if (jobIds.length === 0) return

        await db.delete(queueItems).where(inArray(queueItems.id, jobIds))
        this.log.warn({ jobIds }, 'Jobs cancelled')
    }

    async status() {
        const { jobCount } = await this.fetchQueueStats()
        const avgDurationMs = this.avgDurationMs()
        const estimatedSeconds =
            avgDurationMs !== null ? Math.round((avgDurationMs * jobCount) / 1000) : null

        return {
            running: this.running,
            processing: this.processing,
            pendingCount: jobCount,
            estimatedSeconds,
            currentSceneId: this.currentJob?.sceneId ?? null,
            currentJob: this.currentJob
                ? {
                      id: this.currentJob.id,
                      type: this.currentJob.type,
                      projectId: this.currentJob.projectId,
                      sceneId: this.currentJob.sceneId,
                      sceneVariationId: this.currentJob.sceneVariationId,
                      sceneName: this.currentJob.sceneName,
                      prompt: this.currentJob.prompt,
                      startedAt: this.currentJob.startedAt,
                      elapsedSeconds: Math.max(
                          0,
                          Math.floor((Date.now() - this.currentJob.startedAtMs) / 1000),
                      ),
                  }
                : null,
            avgDurationMs,
            durationSampleSize: this.recentDurations.length,
            completedCount: this.completedCount,
            failedCount: this.failedCount,
            recent: this.recentHistory,
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

        return { jobCount: (sceneRow?.jobCount ?? 0) + (playgroundRow?.jobCount ?? 0) }
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
            // idc about same priority items being processed in random order
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

            const next =
                nextScene && nextPlayground
                    ? nextScene.sortIndex <= nextPlayground.sortIndex
                        ? nextScene
                        : nextPlayground
                    : (nextScene ?? nextPlayground)

            if (!next) {
                this.log.debug('Queue processor found no pending jobs')
                break
            }

            const startedAtMs = Date.now()
            const startedAt = new Date(startedAtMs).toISOString()
            this.currentJob = {
                ...next,
                startedAt,
                startedAtMs,
            }
            publishQueueChanged()
            this.log.info(
                {
                    jobId: next.id,
                    type: next.type,
                    projectId: next.projectId,
                    sceneId: next.sceneId,
                    sceneVariationId: next.sceneVariationId,
                },
                'Queue job started',
            )
            try {
                const runner =
                    next.type === 'playground' ? runPlaygroundJob(next.id) : runJob(next.id)
                for await (const variationDurationMs of runner) {
                    this.recordDurationMs(variationDurationMs)
                }
                this.completedCount += 1
                this.recordHistory({
                    jobId: next.id,
                    type: next.type,
                    projectId: next.projectId,
                    sceneId: next.sceneId,
                    sceneVariationId: next.sceneVariationId,
                    sceneName: next.sceneName,
                    prompt: next.prompt,
                    status: 'completed',
                    startedAt,
                    durationMs: Date.now() - startedAtMs,
                    error: null,
                    failureCategory: null,
                })
                this.log.info(
                    {
                        jobId: next.id,
                        type: next.type,
                        durationMs: Date.now() - startedAtMs,
                    },
                    'Queue job completed',
                )
            } catch (error) {
                this.log.error(
                    {
                        jobId: next.id,
                        type: next.type,
                        projectId: next.projectId,
                        sceneId: next.sceneId,
                        sceneVariationId: next.sceneVariationId,
                        durationMs: Date.now() - startedAtMs,
                        err: error,
                    },
                    'Job failed — stopping queue',
                )
                this.failedCount += 1
                this.recordHistory({
                    jobId: next.id,
                    type: next.type,
                    projectId: next.projectId,
                    sceneId: next.sceneId,
                    sceneVariationId: next.sceneVariationId,
                    sceneName: next.sceneName,
                    prompt: next.prompt,
                    status: 'failed',
                    startedAt,
                    durationMs: Date.now() - startedAtMs,
                    error: error instanceof Error ? error.message : String(error),
                    failureCategory: failureCategory(error),
                })
                this.running = false
                break
            } finally {
                this.currentJob = null
                publishQueueChanged()
            }
        }

        this.running = false
        this.processing = false
        this.log.info('Queue finished')
        publishQueueChanged()
    }

    private recordDurationMs(milliseconds: number) {
        this.recentDurations.push(milliseconds)

        if (this.recentDurations.length > DURATION_BUFFER_SIZE) this.recentDurations.shift()
    }

    private recordHistory(entry: Omit<QueueHistoryEntry, 'id' | 'completedAt'>) {
        this.recentHistory.unshift({
            id: this.nextHistoryId++,
            completedAt: new Date().toISOString(),
            ...entry,
        })

        if (this.recentHistory.length > HISTORY_BUFFER_SIZE) this.recentHistory.pop()
    }

    private avgDurationMs() {
        if (this.recentDurations.length === 0) return null

        return this.recentDurations.reduce((a, b) => a + b, 0) / this.recentDurations.length
    }
}

export const queueManager = new QueueManager()
