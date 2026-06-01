import { zValidator } from '@hono/zod-validator'
import { SettingsPatchBody } from '@nai-factory/shared'
import { Hono } from 'hono'
import logger from '@/logger'
import * as settingsService from '@/services/app/settings'
import * as novelAIService from '@/services/novelai/novelai'

const log = logger.child({ module: 'settings-domain' })

export const setting = new Hono()
    .get('/novelai/status', async (c) => {
        const settings = settingsService.get()
        const mode = settings.novelai.mode
        const updatedAt = new Date().toISOString()

        if (mode === 'mock') {
            return c.json({
                mode,
                configured: true,
                unlimited: false,
                anlas: 12345,
                error: null,
                updatedAt,
            })
        }

        if (mode === 'fail') {
            return c.json({
                mode,
                configured: true,
                unlimited: false,
                anlas: null,
                error: 'NovelAI fail test mode',
                updatedAt,
            })
        }

        if (!settings.novelai.apiKey) {
            return c.json({
                mode,
                configured: false,
                unlimited: false,
                anlas: null,
                error: null,
                updatedAt,
            })
        }

        try {
            const status = await novelAIService.fetchAnlasStatus(settings.novelai.apiKey)
            return c.json({
                mode,
                configured: true,
                unlimited: status.unlimited,
                anlas: status.anlas,
                error: null,
                updatedAt,
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            log.warn({ err: error }, 'NovelAI account status failed')
            return c.json({
                mode,
                configured: true,
                unlimited: false,
                anlas: null,
                error: message,
                updatedAt,
            })
        }
    })
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
