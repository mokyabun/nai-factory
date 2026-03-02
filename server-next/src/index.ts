import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { cors } from '@elysiajs/cors'
import { staticPlugin } from '@elysiajs/static'
import { Elysia } from 'elysia'
import logger from '@/logger'
import { apiRoutes } from '@/routes'

const PORT = Number(process.env.PORT ?? 3000)
const log = logger.child({ module: 'server' })

const SPA_PATH = resolve(import.meta.dir, '../../web/build')

const app = new Elysia().use(cors())

// Serve SPA only if the build directory exists
if (existsSync(SPA_PATH)) {
    app.use(
        staticPlugin({
            assets: SPA_PATH,
            prefix: '/',
            alwaysStatic: false,
        }),
    )
} else {
    log.warn('SPA build directory not found, skipping static file serving')
}

app.onError(({ code, error, set }) => {
    if (code === 'VALIDATION') {
        set.status = 422
        return { error: 'Validation Error', message: error.message }
    }
    if (code === 'NOT_FOUND') {
        set.status = 404
        return { error: 'Not Found', message: error.message }
    }

    log.error({ code, err: error }, 'Unhandled error')
    set.status = 500
    return { error: 'Internal Server Error' }
})
    .use(apiRoutes)
    .listen(PORT)

log.info({ port: PORT }, `Server started at http://localhost:${PORT}`)

export type App = typeof app
