import { Database } from 'bun:sqlite'
import { afterAll, describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { contract } from '@nai-factory/shared'

import { openDatabase, scenes } from '@/db'
import { LegacyDatabaseError } from '@/db/migrate'

import { createTestApp } from '../helpers/app'
import { createScene } from '../helpers/fixtures'

const dir = await mkdtemp(join(tmpdir(), 'db-test-'))
afterAll(() => rm(dir, { recursive: true, force: true }))

describe('database', () => {
    it('migrates an empty data folder and creates the singleton rows', async () => {
        const t = await createTestApp({ inMemory: false })
        try {
            const settings = await t.call(contract.settings.get)
            expect(settings.novelai.mode).toBe('mock')
            const state = await t.call(contract.playground.state)
            expect(state.parameters.width).toBe(1024)
        } finally {
            await t.close()
        }
    })

    it('refuses databases from the previous version', () => {
        const path = join(dir, 'legacy.db')
        const legacy = new Database(path)
        legacy.run('CREATE TABLE _migration_history (id INTEGER PRIMARY KEY, tag TEXT)')
        legacy.close()
        expect(() => openDatabase({ path })).toThrow(LegacyDatabaseError)
    })

    it('allows equal positions and orders them by id', async () => {
        const t = await createTestApp()
        try {
            const { projectId, scene: first } = await createScene(t, { name: 'first' })
            const second = await t.call(contract.scenes.create, {
                body: { projectId, name: 'second' },
            })
            t.ctx.db.update(scenes).set({ position: first.position }).run()
            const list = await t.call(contract.scenes.list, { query: { projectId } })
            expect(list.map((scene) => scene.id)).toEqual([first.id, second.id])
        } finally {
            await t.close()
        }
    })

    it('serializes every timestamp as ISO-8601 UTC', async () => {
        const t = await createTestApp()
        try {
            const { projectId, scene } = await createScene(t)
            const values = [
                await t.call(contract.projects.get, { params: { id: projectId } }),
                await t.call(contract.scenes.get, { params: { id: scene.id } }),
                await t.call(contract.settings.get),
            ]
            const timestamps =
                JSON.stringify(values).match(/"(createdAt|updatedAt)":"[^"]+"/g) ?? []
            expect(timestamps.length).toBeGreaterThan(4)
            for (const match of timestamps) expect(match).toMatch(/Z"$/)
        } finally {
            await t.close()
        }
    })
})
