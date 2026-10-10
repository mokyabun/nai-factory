import { createApp } from './app'
import { closeContext, createContext, startBackgroundTasks } from './bootstrap'
import { loadConfig } from './config'
import { LegacyDatabaseError } from './db/migrate'
import logger from './logger'
import { isLoopback } from './modules/security/middleware'

const log = logger.child({ module: 'server' })
const config = loadConfig()

function openContext() {
    try {
        return createContext(config, logger)
    } catch (error) {
        if (error instanceof LegacyDatabaseError) {
            log.fatal({ event: 'db.legacy', databasePath: config.databasePath }, error.message)
            process.exit(1)
        }
        throw error
    }
}

const ctx = openContext()

const app = createApp(ctx)
const stopBackgroundTasks = await startBackgroundTasks(ctx)

const server = Bun.serve({
    hostname: config.host,
    port: config.port,
    // SSE connections stay open; heartbeats keep proxies from closing them.
    idleTimeout: 0,
    maxRequestBodySize: config.maxUploadBytes,
    fetch: app.fetch,
})

log.info(
    {
        event: 'server.started',
        url: server.url.href,
        environment: config.env,
        dataDir: ctx.paths.root,
        dataEncryption: config.encryptionKey !== null,
        accessToken: config.accessToken !== null,
    },
    'Server started',
)

if (!isLoopback(config.host) && !config.accessToken) {
    log.warn(
        { event: 'security.exposed', host: config.host },
        'Listening on a non-loopback address without NAI_FACTORY_ACCESS_TOKEN: anyone on the network can use this server',
    )
}

async function shutdown(signal: string) {
    log.info({ event: 'server.stopping', signal }, 'Shutting down')
    stopBackgroundTasks()
    // Open SSE streams never finish on their own, so a graceful stop would wait forever.
    await server.stop(true)
    await closeContext(ctx)
    process.exit(0)
}

process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('SIGTERM', () => void shutdown('SIGTERM'))
