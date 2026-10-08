import { afterAll, describe, expect, it } from 'bun:test'

import { contract } from '@nai-factory/shared'

import { createTestApp } from './helpers/app'

const t = await createTestApp()
afterAll(() => t.close())

describe('health check', () => {
    it('reports the server as healthy', async () => {
        expect((await t.request('/healthz')).status).toBe(200)
        expect(await t.call(contract.system.health)).toMatchObject({ ok: true })
    })

    it('returns JSON errors for unknown API paths', async () => {
        const response = await t.request('/api/nope')
        expect(response.status).toBe(404)
        expect(await response.json()).toMatchObject({ error: { code: 'not_found' } })
    })
})
