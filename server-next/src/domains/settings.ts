import { zValidator } from '@hono/zod-validator'
<<<<<<< HEAD
import { SettingsPatchBody } from '@nai-factory/types'
import { Hono } from 'hono'
import { get, reset, update } from '#/services'

export const setting = new Hono()
    .get('/', (c) => c.json(get()))
    .patch('/', zValidator('json', SettingsPatchBody), (c) => c.json(update(c.req.valid('json'))))
    .delete('/', (c) => {
        reset()
=======
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
>>>>>>> refs/remotes/origin/main
        return c.body(null, 204)
    })
