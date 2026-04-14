import { cors } from '@elysiajs/cors'
import { Elysia } from 'elysia'
import { characterPrompt } from './domain/character-prompt'
import { group } from './domain/group'
import { image } from './domain/image'
import { project } from './domain/project'
import { queue } from './domain/queue'
import { scene } from './domain/scene'
import { sdStudio } from './domain/sd-studio'
import { setting } from './domain/settings'
import { sse } from './domain/sse'
import { vibeTransfer } from './domain/vibe-transfer'

const PORT = Number(process.env.PORT ?? 3000)

const app = new Elysia()
    .use(cors())
    .get('/data/*', ({ params }) => Bun.file(`./data/${params['*']}`))
    .onError(({ code, error, set }) => {
        if (code === 'VALIDATION') {
            set.status = 422
            return { message: 'Validation error', details: error.message }
        }
        if (code === 'NOT_FOUND') {
            set.status = 404
            return { message: 'Not found' }
        }
        // SSE client disconnect — Elysia's adapter tries to finalize the response body
        // after the ReadableStream is already cancelled. Suppress to avoid noise.
        if (error instanceof TypeError && error.message.includes('Controller is already closed')) {
            return
        }
        console.error('[error]', error)
        set.status = 500
        return {
            message: error instanceof Error ? error.message : 'Internal server error',
        }
    })
    .group('/api', (app) =>
        app
            .use(group)
            .use(project)
            .use(characterPrompt)
            .use(vibeTransfer)
            .use(scene)
            .use(image)
            .use(queue)
            .use(sdStudio)
            .use(setting)
            .use(sse),
    )
    .listen(PORT)

console.log(`🦊 NAI Factory server running at http://localhost:${PORT}`)

export type App = typeof app
