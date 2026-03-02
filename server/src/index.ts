import { cors } from '@elysiajs/cors'
import { Elysia } from 'elysia'
import { characterPrompt } from './domain/character-prompts'
import { group } from './domain/group'
import { image } from './domain/image'
import { project } from './domain/project'
import { queue } from './domain/queue'
import { scene } from './domain/scene'
import { setting } from './domain/settings'
import { vibeTransfer } from './domain/vibe-transfer'

const PORT = Number(process.env.PORT ?? 3000)

const app = new Elysia()
    .use(cors())
    .onError(({ code, error, set }) => {
        if (code === 'VALIDATION') {
            set.status = 422
            return { message: 'Validation error', details: error.message }
        }
        if (code === 'NOT_FOUND') {
            set.status = 404
            return { message: 'Not found' }
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
            .use(setting),
    )
    .listen(PORT)

console.log(`🦊 NAI Factory server running at http://localhost:${PORT}`)

export type App = typeof app
