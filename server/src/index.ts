import { createApp } from './app'
import logger from './logger'

const port = Number(process.env.PORT ?? 3000)
const app = createApp().listen(port)

logger.info({ port }, 'NAI Factory server running')

export type App = typeof app
