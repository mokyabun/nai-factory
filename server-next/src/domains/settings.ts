import { zValidator } from '@hono/zod-validator'
import { UpdateSettingsBody } from '@nai-factory/types'
import { Hono } from 'hono'
import * as settingsService from '#/services/settings'

export const setting = new Hono()
    .get('/', (c) => c.json(settingsService.get()))
    .patch('/', zValidator('json', UpdateSettingsBody), (c) =>
        c.json(settingsService.update(c.req.valid('json'))),
    )
    .delete('/', (c) => {
        settingsService.reset()
        return c.body(null, 204)
    })
