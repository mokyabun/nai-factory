import { Hono } from 'hono'
import logger from '@/logger'
import { clearDebugRequests, listDebugRequests } from '@/services/debug-log'

const log = logger.child({ module: 'debug-domain' })

export const debug = new Hono()
    .get('/requests', async (c) => c.json(listDebugRequests()))
    .delete('/requests', async (c) => {
        clearDebugRequests()
        log.debug('Debug request history cleared')
        return c.body(null, 204)
    })
