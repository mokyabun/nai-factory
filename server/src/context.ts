import type { Database } from 'bun:sqlite'

import type { AppConfig } from './config'
import type { Db } from './db'
import type { NovelAIClient } from './integrations/novelai/client'
import type { DataPaths } from './lib/paths'
import type { Storage } from './lib/storage'
import type { Logger } from './logger'
import type { DebugLog } from './modules/debug/service'
import type { Scheduler } from './modules/jobs/scheduler'
import type { RealtimeHub } from './modules/realtime/hub'
import type { createAnlasCache } from './modules/settings/routes'
import type { SettingsStore } from './modules/settings/service'

export type AppEnv = {
    Variables: {
        requestId: string
        /** Check JSON responses against the contract (development and test). */
        validateResponses: boolean
    }
}

export type AppContext = {
    config: AppConfig
    log: Logger
    db: Db
    sqlite: Database
    paths: DataPaths
    storage: Storage
    events: RealtimeHub
    settings: SettingsStore
    debugLog: DebugLog
    novelai: NovelAIClient
    scheduler: Scheduler
    anlasCache: ReturnType<typeof createAnlasCache>
}
