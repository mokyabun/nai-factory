import { asc, count, eq, inArray, max, min } from 'drizzle-orm'
import { db, queueItems, scenes, sceneVariations } from '#/db'
import logger from '#/logger'
import { domainEvents } from './events'
import { runJob } from './queue-runner'

export type EnqueuePosition = 'back' | 'front'

const DURATION_BUFFER_SIZE = 100
const HISTORY_BUFFER_SIZE = 100

type QueueHistoryEntry = {
    id: number
    jobId: number
    projectId: number
    sceneId: number
    sceneVariationId: number
    sceneName: string
    status: 'completed' | 'failed'
    durationMs: number
    completedAt: string
    error: string | null
}

type CurrentJob = {
    id: number
    projectId: number
    sceneId: number
    sceneVariationId: number
    sceneName: string
    startedAt: string
    startedAtMs: number
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

        this.log.debug({ sceneId, sceneVariationId, position, count: items.length }, 'Job enqueued')

        if (this.running && !this.processing) this.processQueue()

        return items
    }

    start() {
        if (this.running) return

        this.running = true
        this.log.info('Queue started')

        if (!this.processing) this.processQueue()
    }

    stop() {
        if (!this.running) return

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
                      projectId: this.currentJob.projectId,
                      sceneId: this.currentJob.sceneId,
                      sceneVariationId: this.currentJob.sceneVariationId,
                      sceneName: this.currentJob.sceneName,
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
        const [row] = await db.select({ jobCount: count() }).from(queueItems)

        return { jobCount: row?.jobCount ?? 0 }
    }

    private async nextSortIndex(position: EnqueuePosition, count: number) {
        const [row] = await db
            .select({
                minSortIndex: min(queueItems.sortIndex),
                maxSortIndex: max(queueItems.sortIndex),
            })
            .from(queueItems)

        if (position === 'front') return (row?.minSortIndex ?? 0) - count

        return (row?.maxSortIndex ?? 0) + 1
    }

    private async processQueue(): Promise<void> {
        if (this.processing) return
        this.processing = true

        while (this.running) {
            // idc about same priority items being processed in random order
            const [next] = await db
                .select({
                    id: queueItems.id,
                    projectId: queueItems.projectId,
                    sceneId: queueItems.sceneId,
                    sceneVariationId: queueItems.sceneVariationId,
                    sceneName: scenes.name,
                })
                .from(queueItems)
                .innerJoin(scenes, eq(queueItems.sceneId, scenes.id))
                .orderBy(asc(queueItems.sortIndex))
                .limit(1)

            if (!next) break

            const startedAtMs = Date.now()
            this.currentJob = {
                ...next,
                startedAt: new Date(startedAtMs).toISOString(),
                startedAtMs,
            }
            try {
                for await (const variationDurationMs of runJob(next.id)) {
                    this.recordDurationMs(variationDurationMs)
                    domainEvents.invalidate('queue')
                }
                this.completedCount += 1
                this.recordHistory({
                    jobId: next.id,
                    projectId: next.projectId,
                    sceneId: next.sceneId,
                    sceneVariationId: next.sceneVariationId,
                    sceneName: next.sceneName,
                    status: 'completed',
                    durationMs: Date.now() - startedAtMs,
                    error: null,
                })
            } catch (error) {
                this.log.error({ jobId: next.id, err: error }, 'Job failed — stopping queue')
                this.failedCount += 1
                this.recordHistory({
                    jobId: next.id,
                    projectId: next.projectId,
                    sceneId: next.sceneId,
                    sceneVariationId: next.sceneVariationId,
                    sceneName: next.sceneName,
                    status: 'failed',
                    durationMs: Date.now() - startedAtMs,
                    error: error instanceof Error ? error.message : String(error),
                })
                this.running = false
                break
            } finally {
                this.currentJob = null
                domainEvents.invalidate('queue')
            }
        }

        this.running = false
        this.processing = false
        this.log.info('Queue finished')
        domainEvents.invalidate('queue')
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
