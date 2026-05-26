import { Hono } from 'hono'
import { clearDebugRequests, listDebugRequests } from '#/services/debug-log'

export const debug = new Hono()
    .get('/requests', async (c) => c.json(listDebugRequests()))
    .delete('/requests', async (c) => {
        clearDebugRequests()
        return c.body(null, 204)
    })
