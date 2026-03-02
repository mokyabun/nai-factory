import { Elysia } from 'elysia'
import { characterPromptRoutes } from './character-prompts'
import { groupRoutes } from './groups'
import { imageRoutes } from './images'
import { projectRoutes } from './projects'
import { queueRoutes } from './queue'
import { sceneRoutes } from './scenes'
import { settingsRoutes } from './settings'
import { variationRoutes } from './variations'
import { vibeTransferRoutes } from './vibe-transfers'

export const apiRoutes = new Elysia({ prefix: '/api' })
    .use(groupRoutes)
    .use(projectRoutes)
    .use(characterPromptRoutes)
    .use(vibeTransferRoutes)
    .use(sceneRoutes)
    .use(variationRoutes)
    .use(imageRoutes)
    .use(queueRoutes)
    .use(settingsRoutes)
