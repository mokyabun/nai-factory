import { asc, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { db, queueItems, scenes } from '@/db'
import logger from '@/logger'
import { runJob } from './queue-runner'

export type EnqueuePosition = 'back' | 'front'

const DURATION_BUFFER_SIZE = 20

class QueueManager {
    private readonly log = logger.child({ module: 'queue' })
    private readonly recentDurations: number[] = []

    private processing = false
    private running = false

    async enqueue(sceneId: number, variationId: number | null, position: EnqueuePosition = 'back') {
        const [scene] = await db
            .select({ projectId: scenes.projectId })
            .from(scenes)
            .where(eq(scenes.id, sceneId))
        if (!scene) throw new Error(`Scene ${sceneId} not found`)

        const priority = await this.resolvePriority(position)

        const [item] = await db
            .insert(queueItems)
            .values({ projectId: scene.projectId, sceneId, variationId, priority })
            .returning()
        if (!item) throw new Error('Failed to create queue item')

        this.log.debug({ sceneId, position, priority }, 'Job enqueued')

        if (this.running && !this.processing) this.processQueue()

        return item
    }

    startQueue() {
        if (this.running) return
        this.running = true
        this.log.info('Queue started')
        if (!this.processing) this.processQueue()
    }

    stopQueue() {
        if (!this.running) return
        this.running = false
        this.log.info('Queue stopped')
    }

    cancelJobs(jobIds: number[]) {
        db.delete(queueItems).where(inArray(queueItems.id, jobIds)).catch(console.error)
        this.log.warn({ jobIds }, 'Jobs cancelled')
    }

    async getStatus() {
        const [row] = await db.select({ count: count() }).from(queueItems)
        const pendingCount = row?.count ?? 0
        const avg = this.avgDuration()
        const estimatedSeconds = avg !== null ? Math.round(avg * pendingCount) : null

        return {
            running: this.running,
            processing: this.processing,
            pendingCount,
            estimatedSeconds,
        }
    }

    private async resolvePriority(position: EnqueuePosition): Promise<number> {
        if (position === 'back') return 0
        const [row] = await db
            .select({ maxPriority: sql<number | null>`MAX(${queueItems.priority})` })
            .from(queueItems)
        return (row?.maxPriority ?? 0) + 1
    }

    private async processQueue(): Promise<void> {
        if (this.processing) return
        this.processing = true

        while (this.running) {
            const [next] = await db
                .select({ id: queueItems.id })
                .from(queueItems)
                .orderBy(desc(queueItems.priority), asc(queueItems.createdAt))
                .limit(1)

            if (!next) break

            try {
                const duration = await runJob(next.id)
                if (duration !== null) this.recordDuration(duration)
            } catch (error) {
                this.log.error({ jobId: next.id, err: error }, 'Job failed — stopping queue')
                this.running = false
                break
            }
        }

        this.running = false
        this.processing = false
        this.log.info('Queue finished')
    }

    private recordDuration(seconds: number) {
        this.recentDurations.push(seconds)
        if (this.recentDurations.length > DURATION_BUFFER_SIZE) this.recentDurations.shift()
    }

    private avgDuration() {
        if (this.recentDurations.length === 0) return null
        return this.recentDurations.reduce((a, b) => a + b, 0) / this.recentDurations.length
    }
}

export const queueManager = new QueueManager()
