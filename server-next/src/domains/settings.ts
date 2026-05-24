import { zValidator } from '@hono/zod-validator'
import { SettingsPatchBody } from '@nai-factory/types'
import { Hono } from 'hono'
import * as settingsService from '../services/settings'

export const setting = new Hono()
    .get('/', async (c) => c.json(await settingsService.get()))
    .patch('/', zValidator('json', SettingsPatchBody), async (c) => {
        const body = c.req.valid('json')
        return c.json(await settingsService.update(body))
    })
    .delete('/', async (c) => {
        settingsService.reset()
        return c.json(settingsService.get())
    })
