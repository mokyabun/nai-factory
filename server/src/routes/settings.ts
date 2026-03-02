import { eq } from 'drizzle-orm'
import { Elysia, status, t } from 'elysia'
import { db } from '@/db'
import { settings } from '@/db/schema'
import { naiService } from '@/services/novelai'

const SettingsModel = {
    keyParams: t.Object({ key: t.String() }),
    setValue: t.Object({ value: t.String() }),
    validateApiKey: t.Object({ apiKey: t.String({ minLength: 1 }) }),
}

async function getAll() {
    const rows = await db.select().from(settings)
    return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

async function getByKey(key: string) {
    const [row] = await db.select().from(settings).where(eq(settings.key, key))

    if (!row) throw status(404, 'Setting not found')
    return { key: row.key, value: row.value }
}

async function set(key: string, value: string) {
    await db
        .insert(settings)
        .values({ key, value })
        .onConflictDoUpdate({ target: settings.key, set: { value } })

    return { key, value }
}

async function validateApiKey(apiKey: string) {
    const isValid = await naiService.validateApiKey(apiKey)

    if (!isValid) throw status(400, 'Invalid API key')

    await db
        .insert(settings)
        .values({ key: 'api_key', value: apiKey })
        .onConflictDoUpdate({ target: settings.key, set: { value: apiKey } })

    return { valid: true, message: 'API key saved successfully' }
}

export const setting = new Elysia({ prefix: '/settings' })
    .get('/', () => getAll())
    .get('/:key', ({ params }) => getByKey(params.key), { params: SettingsModel.keyParams })
    .put('/:key', ({ params, body }) => set(params.key, body.value), {
        params: SettingsModel.keyParams,
        body: SettingsModel.setValue,
    })
    .post('/validate-api-key', ({ body }) => validateApiKey(body.apiKey), {
        body: SettingsModel.validateApiKey,
    })
