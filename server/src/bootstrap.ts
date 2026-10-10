import type { AppConfig } from './config'
import type { AppContext } from './context'
import { openDatabase } from './db'
import { createNovelAIClient, type FetchLike } from './integrations/novelai/client'
import { createDataPaths } from './lib/paths'
import { createStorage } from './lib/storage'
import type { Logger } from './logger'
import * as assets from './modules/assets/service'
import { createDebugLog } from './modules/debug/service'
import { createScheduler } from './modules/jobs/scheduler'
import { createRealtimeHub } from './modules/realtime/hub'
import { createAnlasCache } from './modules/settings/routes'
import { createSettingsStore } from './modules/settings/service'

export type ContextOptions = {
    /** Replaces `fetch` for NovelAI requests (tests). */
    novelaiFetch?: FetchLike
    novelaiRetryBaseDelayMs?: number
    novelaiTimeouts?: Partial<{ generate: number; encode: number; account: number }>
}

const GC_INTERVAL_MS = 24 * 60 * 60 * 1000

export function createContext(config: AppConfig, log: Logger, options: ContextOptions = {}) {
    const paths = createDataPaths(config.dataDir)
    const { db, sqlite, backupPath } = openDatabase({
        path: config.databasePath,
        cacheSize: config.databaseCacheSize,
        migrationsDir: config.migrationsDir,
    })
    if (backupPath) {
        log.info({ event: 'db.backup', backupPath }, 'Database backed up before migrations')
    }
    const events = createRealtimeHub()
    const settings = createSettingsStore(db, config, events)
    const debugLog = createDebugLog(db, events, settings, log)

    const ctx = {
        config,
        log,
        db,
        sqlite,
        paths,
        storage: createStorage(paths, config.encryptionKey),
        events,
        settings,
        debugLog,
        anlasCache: createAnlasCache(),
        novelai: createNovelAIClient({
            log,
            fetch: options.novelaiFetch,
            recorder: debugLog.recorder,
            retryBaseDelayMs: options.novelaiRetryBaseDelayMs,
            timeouts: options.novelaiTimeouts,
        }),
    } as Omit<AppContext, 'scheduler'> as AppContext
    ctx.scheduler = createScheduler(ctx)
    return ctx
}

export async function startBackgroundTasks(ctx: AppContext) {
    ctx.scheduler.recover()
    await ctx.storage.removeDir('tmp')

    const runGc = () =>
        assets.collectGarbage(ctx, { dryRun: false }).catch((error: unknown) => {
            ctx.log.warn({ err: error }, 'Asset garbage collection failed')
        })
    await runGc()
    const timer = setInterval(() => void runGc(), GC_INTERVAL_MS)
    timer.unref()
    return () => clearInterval(timer)
}

export async function closeContext(ctx: AppContext) {
    await ctx.scheduler.shutdown()
    ctx.events.flush()
    ctx.sqlite.close()
}
