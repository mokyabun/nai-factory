import { Elysia, status, t } from 'elysia'
import { validateApiKey } from '@/services/novelai'
import * as settingsService from '@/services/settings'

export const settingsRoutes = new Elysia({ prefix: '/settings' })
    .get('/', () => settingsService.getSettings())

    .patch(
        '/global-variables',
        ({ body }) => settingsService.updateGlobalVariables(body.variables),
        {
            body: t.Object({ variables: t.Record(t.String(), t.String()) }),
        },
    )

    .patch('/novelai', ({ body }) => settingsService.updateNovelaiSettings(body), {
        body: t.Object({
            novelaiApiKey: t.Optional(t.String()),
            model: t.Optional(
                t.Union([
                    t.Literal('nai-diffusion-4-5-full'),
                    t.Literal('nai-diffusion-4-5-curated'),
                    t.Literal('nai-diffusion-4-full'),
                    t.Literal('nai-diffusion-4-curated'),
                ]),
            ),
            qualityToggle: t.Optional(t.Boolean()),
        }),
    })

    .post(
        '/validate-api-key',
        async ({ body }) => {
            const isValid = await validateApiKey(body.apiKey)
            if (!isValid) throw status(400, 'Invalid API key')

            // Also save the valid key
            await settingsService.updateNovelaiSettings({
                novelaiApiKey: body.apiKey,
            })

            return { valid: true, message: 'API key saved successfully' }
        },
        { body: t.Object({ apiKey: t.String({ minLength: 1 }) }) },
    )
