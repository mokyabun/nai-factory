import { afterAll, describe, expect, it } from 'bun:test'

import { contract } from '@nai-factory/shared'

import { isAllowedHost, isSameOrigin } from '@/modules/security/middleware'

import { createTestApp } from '../helpers/app'
import { createProject } from '../helpers/fixtures'

const t = await createTestApp()
afterAll(() => t.close())

describe('S1: file serving cannot escape the data folder', () => {
    it.each([
        '/api/assets/abc',
        '/api/assets/..%2F..',
        '/api/assets/..%2Fdatabase.db',
        '/api/assets/999',
    ])('%s → 404', async (path) => {
        expect((await t.request(path)).status).toBe(404)
    })

    it('has no /data route', async () => {
        expect((await t.request('/api/data/database.db')).status).toBe(404)
        expect((await t.request('/data/database.db')).status).toBe(404)
        expect((await t.request('/api/data/..%2Fpackage.json')).status).toBe(404)
    })
})

describe('S2: the API key never leaves the server', () => {
    it('shows only a masked hint', async () => {
        t.ctx.settings.setApiKey('pst-secret-key-abcd')
        const response = await t.send(contract.settings.get)
        const text = await response.text()
        expect(text).not.toContain('pst-secret-key-abcd')
        expect(JSON.parse(text).novelai).toEqual({
            mode: 'mock',
            hasApiKey: true,
            keyHint: '****abcd',
        })
        t.ctx.settings.deleteApiKey()
    })

    it('refuses state changes from other origins', async () => {
        const response = await t.send(contract.settings.update, {
            body: { debug: { enabled: true } },
            headers: { origin: 'https://evil.example' },
        })
        expect(response.status).toBe(403)
        expect(t.ctx.settings.get().debug.enabled).toBe(false)
    })

    it('refuses cross-site fetches even without an Origin header', async () => {
        const response = await t.send(contract.projects.create, {
            body: { groupId: null, name: 'x' },
            headers: { 'sec-fetch-site': 'cross-site' },
        })
        expect(response.status).toBe(403)
    })

    it('allows same-origin and dev-server requests', async () => {
        for (const origin of ['http://localhost:3000', 'http://localhost:5173']) {
            const response = await t.send(contract.projects.create, {
                body: { groupId: null, name: 'ok' },
                headers: { origin },
            })
            expect(response.status).toBe(201)
        }
    })

    it('refuses unknown Host names (DNS rebinding)', async () => {
        const response = await t.request('/api/settings', {
            headers: { host: 'evil.example:3000' },
        })
        expect(response.status).toBe(403)
    })

    it('accepts loopback names and IP literals as hosts', () => {
        for (const host of [
            'localhost:3000',
            '127.0.0.1',
            '[::1]:3000',
            '192.168.0.10:3000',
            '10.0.0.2',
        ]) {
            expect(isAllowedHost(host, [])).toBe(true)
        }
        expect(isAllowedHost('nas.local', [])).toBe(false)
        expect(isAllowedHost('nas.local:3000', ['nas.local'])).toBe(true)
        expect(
            isSameOrigin({
                origin: 'http://nas.local:3000',
                host: 'nas.local:3000',
                fetchSite: undefined,
                extraOrigins: [],
            }),
        ).toBe(true)
    })
})

describe('S3: server export is limited to the export folder', () => {
    it('is disabled without NAI_FACTORY_EXPORT_DIR', async () => {
        const project = await createProject(t)
        const response = await t.send(contract.projects.exportServer, {
            params: { id: project.id },
            body: { imageCount: 1, folder: 'out' },
        })
        expect(response.status).toBe(400)
        expect((await t.call(contract.settings.get)).export.serverExportEnabled).toBe(false)
    })

    it('rejects folder names that leave the export folder', async () => {
        const project = await createProject(t)
        for (const folder of ['../x', '..', 'a/b', '/tmp']) {
            const response = await t.send(contract.projects.exportServer, {
                params: { id: project.id },
                body: { imageCount: 1, folder },
            })
            expect(response.status).toBe(400)
        }
    })
})

describe('optional access token', async () => {
    const secured = await createTestApp({ env: { NAI_FACTORY_ACCESS_TOKEN: 'let-me-in' } })
    afterAll(() => secured.close())

    it('requires the token for API calls', async () => {
        expect((await secured.send(contract.settings.get)).status).toBe(401)
        expect((await secured.request('/api/assets/1')).status).toBe(401)
        expect((await secured.send(contract.system.health)).status).toBe(200)
    })

    it('accepts a bearer token or the login cookie', async () => {
        expect(
            (
                await secured.send(contract.settings.get, {
                    headers: { authorization: 'Bearer let-me-in' },
                })
            ).status,
        ).toBe(200)

        expect(
            (await secured.send(contract.system.login, { body: { token: 'nope' } })).status,
        ).toBe(401)
        const login = await secured.send(contract.system.login, { body: { token: 'let-me-in' } })
        const cookie = login.headers.get('set-cookie') ?? ''
        expect(cookie).toContain('HttpOnly')
        const response = await secured.send(contract.settings.get, {
            headers: { cookie: cookie.split(';')[0] as string },
        })
        expect(response.status).toBe(200)
    })
})
