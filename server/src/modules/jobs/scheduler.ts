import type { JobKind, QueuePauseReason, QueueState } from '@nai-factory/shared'

import type { AppContext } from '@/context'

import { classifyError, type ExecutionOutcome, runPlaygroundJob, runSceneJob } from './executor'
import * as repo from './repo'

const SAMPLE_SIZE = 100
export const HISTORY_LIMIT = 200

export class RollingSamples {
    private readonly samples: number[] = []

    constructor(private readonly capacity: number) {}

    push(value: number) {
        this.samples.push(value)
        if (this.samples.length > this.capacity) this.samples.shift()
    }

    get size() {
        return this.samples.length
    }

    average() {
        if (this.samples.length === 0) return null
        return this.samples.reduce((a, b) => a + b, 0) / this.samples.length
    }
}

export type CurrentJob = {
    jobId: number
    kind: JobKind
    startedAt: Date
    total: number | null
    done: number
    imageStartedAt: Date | null
    abort: AbortController
    /** Why the job was aborted; a shutdown requeues it instead of cancelling. */
    abortReason: 'cancel' | 'deleted' | 'shutdown' | null
}

export function deriveQueueState(input: {
    running: boolean
    processing: boolean
    pendingCount: number
}): QueueState {
    if (input.processing) return input.running ? 'running' : 'pausing'
    if (input.pendingCount > 0) return 'paused'
    return 'idle'
}

export type EstimateInput = {
    now: number
    /** Waiting jobs per kind, excluding the running one. */
    waiting: Record<JobKind, number>
    avgImageMs: number | null
    avgJobMs: Record<JobKind, number | null>
    current: Pick<CurrentJob, 'kind' | 'total' | 'done' | 'imageStartedAt'> | null
}

/** Waiting jobs are estimated per job because their image counts are only known once compiled. */
export function estimateRemainingMs(input: EstimateInput): number | null {
    const jobMs = (kind: JobKind) => input.avgJobMs[kind] ?? input.avgImageMs
    let total = 0

    for (const kind of ['scene', 'playground'] as const) {
        const count = input.waiting[kind]
        if (count === 0) continue
        const average = jobMs(kind)
        if (average === null) return null
        total += average * count
    }

    const current = input.current
    if (current) {
        if (current.total !== null && input.avgImageMs !== null) {
            const remaining = Math.max(0, current.total - current.done)
            const elapsed = current.imageStartedAt
                ? input.now - current.imageStartedAt.getTime()
                : 0
            total += Math.max(0, remaining * input.avgImageMs - elapsed)
        } else {
            const average = jobMs(current.kind)
            if (average === null) return null
            total += average
        }
    }

    return total
}

export type Scheduler = ReturnType<typeof createScheduler>

/** Picking the next job and deciding to stop happen in one synchronous step, so no job is stranded. */
export function createScheduler(ctx: AppContext) {
    const log = ctx.log.child({ module: 'scheduler' })
    const imageDurations = new RollingSamples(SAMPLE_SIZE)
    const jobDurations: Record<JobKind, RollingSamples> = {
        scene: new RollingSamples(SAMPLE_SIZE),
        playground: new RollingSamples(SAMPLE_SIZE),
    }

    let running = false
    let processing = false
    let pauseReason: QueuePauseReason | null = null
    let current: CurrentJob | null = null
    let idle: Promise<void> = Promise.resolve()

    const changed = () => ctx.events.publish({ type: 'jobs.changed' })

    function progress() {
        if (!current) return
        ctx.events.publish({
            type: 'job.progress',
            jobId: current.jobId,
            done: current.done,
            total: current.total,
            imageStartedAt: current.imageStartedAt?.toISOString() ?? null,
        })
    }

    async function execute(job: repo.JobRow) {
        const startedAt = new Date()
        repo.update(ctx.db, job.id, {
            status: 'running',
            startedAt: job.startedAt ?? startedAt,
            error: null,
            errorKind: null,
        })
        const abort = new AbortController()
        current = {
            jobId: job.id,
            kind: job.kind,
            startedAt,
            total: job.totalImages,
            done: job.doneImages,
            imageStartedAt: null,
            abort,
            abortReason: null,
        }
        changed()
        log.info({ event: 'job.started', jobId: job.id, kind: job.kind }, 'Job started')

        const hooks = {
            shouldContinue: () => running,
            imageStarted(done: number, total: number) {
                if (!current) return
                current.done = done
                current.total = total
                current.imageStartedAt = new Date()
                progress()
            },
            imageSaved(done: number, total: number, durationMs: number) {
                imageDurations.push(durationMs)
                if (!current) return
                current.done = done
                current.total = total
                current.imageStartedAt = null
                progress()
            },
        }

        let outcome: ExecutionOutcome | 'cancelled' | 'failed'
        try {
            outcome =
                job.kind === 'scene'
                    ? await runSceneJob(ctx, job.id, abort.signal, hooks)
                    : await runPlaygroundJob(ctx, job.id, abort.signal, hooks)
        } catch (error) {
            if (abort.signal.aborted) {
                outcome = current?.abortReason === 'shutdown' ? 'stopped' : 'cancelled'
            } else {
                outcome = 'failed'
                const errorKind = classifyError(error)
                const message = error instanceof Error ? error.message : String(error)
                log.error(
                    { event: 'job.failed', jobId: job.id, errorKind, err: error },
                    'Job failed; pausing queue',
                )
                repo.update(ctx.db, job.id, {
                    status: 'failed',
                    error: message,
                    errorKind,
                    finishedAt: new Date(),
                })
                running = false
                pauseReason = 'failure'
            }
        }

        const finishedAt = new Date()
        if (outcome === 'completed') {
            repo.update(ctx.db, job.id, { status: 'completed', finishedAt })
            jobDurations[job.kind].push(finishedAt.getTime() - startedAt.getTime())
            log.info({ event: 'job.completed', jobId: job.id }, 'Job completed')
        } else if (outcome === 'cancelled') {
            // The row is gone when its scene was deleted; otherwise keep it in the history.
            repo.update(ctx.db, job.id, { status: 'cancelled', finishedAt })
            log.info({ event: 'job.cancelled', jobId: job.id }, 'Job cancelled')
        } else if (outcome === 'stopped') {
            repo.update(ctx.db, job.id, { status: 'queued' })
        }

        current = null
        repo.trimHistory(ctx.db, HISTORY_LIMIT)
        changed()
    }

    async function loop() {
        while (true) {
            // No await between this check and `processing = false`, so wake() never misses a job.
            const next = running ? repo.nextQueued(ctx.db) : null
            if (!next) {
                processing = false
                if (running) {
                    // The queue drained: stop until the user starts it again.
                    running = false
                    pauseReason = null
                    log.info({ event: 'queue.drained' }, 'Queue finished')
                }
                changed()
                return
            }
            await execute(next)
        }
    }

    function wake() {
        if (!running || processing) return
        processing = true
        idle = loop().catch((error: unknown) => {
            processing = false
            running = false
            log.error({ err: error }, 'Queue loop crashed')
            changed()
        })
    }

    return {
        /** Puts jobs left `running` by a crash back into the queue. Call once at startup. */
        recover() {
            const count = repo.requeueRunning(ctx.db)
            if (count > 0)
                log.warn({ event: 'queue.recovered', count }, 'Requeued interrupted jobs')
        },

        start() {
            if (running) return
            running = true
            pauseReason = null
            log.info({ event: 'queue.started' }, 'Queue started')
            changed()
            wake()
        },

        /** Stops after the current image; the running job returns to the queue. */
        stop() {
            if (!running) return
            running = false
            pauseReason = 'user'
            log.info({ event: 'queue.stopped' }, 'Queue stopping')
            changed()
        },

        wake,

        cancel(jobId: number) {
            if (current?.jobId !== jobId) return false
            current.abortReason = 'cancel'
            current.abort.abort(new Error('Job cancelled'))
            return true
        },

        /** Aborts the running job when its row was deleted (e.g. its scene was removed). */
        reconcile() {
            if (current && !repo.getById(ctx.db, current.jobId)) {
                current.abortReason = 'deleted'
                current.abort.abort(new Error('Job deleted'))
            }
            changed()
        },

        current(): Readonly<CurrentJob> | null {
            return current
        },

        state() {
            return { running, processing, pauseReason }
        },

        estimate(now: number, waiting: Record<JobKind, number>) {
            return estimateRemainingMs({
                now,
                waiting,
                avgImageMs: imageDurations.average(),
                avgJobMs: {
                    scene: jobDurations.scene.average(),
                    playground: jobDurations.playground.average(),
                },
                current,
            })
        },

        samples() {
            return { avgImageMs: imageDurations.average(), sampleSize: imageDurations.size }
        },

        /** Resolves when the loop has stopped (tests and shutdown). */
        async idle() {
            await idle
        },

        async shutdown() {
            running = false
            if (current) {
                current.abortReason = 'shutdown'
                current.abort.abort(new Error('Server shutting down'))
            }
            await idle
        },
    }
}
