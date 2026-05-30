import { zValidator } from '@hono/zod-validator'
import { SettingsPatchBody } from '@nai-factory/shared'
import { Hono } from 'hono'
import logger from '#/logger'
import * as settingsService from '#/services/app/settings'

const log = logger.child({ module: 'settings-domain' })

export const setting = new Hono()
    .get('/', async (c) => c.json(await settingsService.get()))
    .patch('/', zValidator('json', SettingsPatchBody), async (c) => {
        const body = c.req.valid('json')
        log.info({ fields: Object.keys(body) }, 'Settings updated')
        return c.json(await settingsService.update(body))
    })
    .delete('/', async (c) => {
        settingsService.reset()
        log.warn('Settings reset')
        return c.json(settingsService.get())
    })
