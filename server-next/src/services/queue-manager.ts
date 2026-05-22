import { asc, count, eq, inArray, sql } from 'drizzle-orm'
import { db, queueItems, scenes } from '../db'
import logger from '../logger'
import { domainEvents } from './events'
import { runJob } from './queue-runner'

export type EnqueuePosition = 'back' | 'front'

const DURATION_BUFFER_SIZE = 20

class QueueManager {
    private readonly log = logger.child({ module: 'queue' })
    private readonly recentDurations: number[] = []

    private processing = false
    private running = false
    private currentSceneId: number | null = null

    async add(sceneId: number, position: EnqueuePosition = 'back') {
        const [scene] = await db
            .select({ projectId: scenes.projectId, variation: scenes.variations })
            .from(scenes)
            .where(eq(scenes.id, sceneId))
        if (!scene) throw new Error(`Scene ${sceneId} not found`)

        // if front, sort index is -now, if back sort index is now (unix timestamp in seconds)
        const sortIndex = position === 'front' ? -Date.now() : Date.now()

        const [item] = await db
            .insert(queueItems)
            .values({
                projectId: scene.projectId,
                sceneId,
                sortIndex,
                variationCount: scene.variation.length,
            })
            .returning()
        if (!item) throw new Error('Failed to create queue item')

        this.log.debug({ sceneId, position, sortIndex }, 'Job enqueued')

        if (this.running && !this.processing) this.processQueue()

        return item
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
        const { jobCount, totalVariations } = await this.fetchQueueStats()
        const avgDurationMs = this.avgDurationMs()
        const estimatedSeconds =
            avgDurationMs !== null ? Math.round((avgDurationMs * totalVariations) / 1000) : null

        return {
            running: this.running,
            processing: this.processing,
            pendingCount: jobCount,
            estimatedSeconds,
            currentSceneId: this.currentSceneId,
        }
    }

    private async fetchQueueStats() {
        const [row] = await db
            .select({
                jobCount: count(),
                totalVariations: sql<number>`coalesce(sum(${queueItems.variationCount}), 0)`,
            })
            .from(queueItems)

        return { jobCount: row?.jobCount ?? 0, totalVariations: row?.totalVariations ?? 0 }
    }

    private async processQueue(): Promise<void> {
        if (this.processing) return
        this.processing = true

        while (this.running) {
            // idc about same priority items being processed in random order
            const [next] = await db
                .select({ id: queueItems.id, sceneId: queueItems.sceneId })
                .from(queueItems)
                .orderBy(asc(queueItems.sortIndex))
                .limit(1)

            if (!next) break

            this.currentSceneId = next.sceneId
            try {
                for await (const variationDurationMs of runJob(next.id)) {
                    this.recordDurationMs(variationDurationMs)
                    domainEvents.invalidate('queue')
                }
            } catch (error) {
                this.log.error({ jobId: next.id, err: error }, 'Job failed — stopping queue')
                this.running = false
                break
            } finally {
                this.currentSceneId = null
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

    private avgDurationMs() {
        if (this.recentDurations.length === 0) return null

        return this.recentDurations.reduce((a, b) => a + b, 0) / this.recentDurations.length
    }
}

export const queueManager = new QueueManager()
