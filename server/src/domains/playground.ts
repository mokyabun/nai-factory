import { zValidator } from '@hono/zod-validator'
import {
    IdParams,
    type Parameters,
    PlaygroundEnqueueBody,
    PlaygroundImageGetQuery,
    PlaygroundSettingsPatchBody,
} from '@nai-factory/types'
import { desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { db, playgroundImages, playgroundSettings } from '#/db'
import { queueManager, remove as removeFile } from '#/services'

const DEFAULT_PARAMETERS: Parameters = {
    model: 'nai-diffusion-4-5-full',
    qualityToggle: false,
    width: 1024,
    height: 1024,
    steps: 28,
    promptGuidance: 6,
    varietyPlus: false,
    seed: 0,
    sampler: 'k_euler_ancestral',
    promptGuidanceRescale: 0.7,
    noiseSchedule: 'karras',
    normalizeReferenceStrengthValues: false,
    useCharacterPositions: false,
}

async function getImages(limit = 30) {
    return db
        .select()
        .from(playgroundImages)
        .orderBy(desc(playgroundImages.createdAt), desc(playgroundImages.id))
        .limit(limit)
}

async function getSettings() {
    const [settings] = await db
        .select()
        .from(playgroundSettings)
        .where(eq(playgroundSettings.id, 1))
        .limit(1)

    if (settings) return settings

    const [created] = await db
        .insert(playgroundSettings)
        .values({ id: 1, parameters: DEFAULT_PARAMETERS })
        .returning()

    if (!created) throw new Error('Failed to create playground settings')
    return created
}

async function patchSettings(data: PlaygroundSettingsPatchBody) {
    await getSettings()

    const [updated] = await db
        .update(playgroundSettings)
        .set({
            ...data,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(playgroundSettings.id, 1))
        .returning()

    if (!updated) throw new Error('Failed to update playground settings')
    return updated
}

async function remove(id: number) {
    const [image] = await db.select().from(playgroundImages).where(eq(playgroundImages.id, id))
    if (!image) return false

    await db.delete(playgroundImages).where(eq(playgroundImages.id, id))
    await removeFile(image.filePath, image.thumbnailPath ?? null)

    return true
}

export const playground = new Hono()
    .get('/settings', async (c) => c.json(await getSettings()))
    .patch('/settings', zValidator('json', PlaygroundSettingsPatchBody), async (c) => {
        const updated = await patchSettings(c.req.valid('json'))
        return c.json(updated)
    })
    .get('/images', zValidator('query', PlaygroundImageGetQuery), async (c) => {
        const { limit } = c.req.valid('query')
        return c.json(await getImages(limit))
    })
    .post('/enqueue', zValidator('json', PlaygroundEnqueueBody), async (c) => {
        const body = c.req.valid('json')
        const item = await queueManager.addPlayground(body, body.position ?? 'back')
        return c.json({ queued: 1, item }, 201)
    })
    .delete('/images/:id', zValidator('param', IdParams), async (c) => {
        if (!(await remove(c.req.valid('param').id))) {
            throw new HTTPException(404, { message: 'Playground image not found' })
        }

        return c.body(null, 204)
    })
