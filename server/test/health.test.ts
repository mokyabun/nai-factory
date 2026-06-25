import { describe, expect, it } from 'bun:test'
import { createApp } from '../src'

describe('health check', () => {
    it('reports the server as healthy', async () => {
        const app = createApp()
        const response = await app.request('/healthz')

        expect(response.status).toBe(200)
        expect(await response.json()).toMatchObject({ ok: true })
    })
})
