import { Database } from 'bun:sqlite'
import { afterAll, describe, expect, it } from 'bun:test'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { contract } from '@nai-factory/shared'

import { openDatabase, scenes } from '@/db'
import { defaultMigrationsDir, LegacyDatabaseError } from '@/db/migrate'

import { createTestApp } from '../helpers/app'
import { createScene } from '../helpers/fixtures'

const dir = await mkdtemp(join(tmpdir(), 'db-test-'))
afterAll(() => rm(dir, { recursive: true, force: true }))

/** A migrations folder holding only the 0.3.0 schema. */
async function initialMigrations() {
    const source = defaultMigrationsDir()
    const target = join(dir, 'migrations-0.3.0')
    await mkdir(join(target, 'meta'), { recursive: true })
    await copyFile(join(source, '0000_init.sql'), join(target, '0000_init.sql'))
    const journal = JSON.parse(await readFile(join(source, 'meta', '_journal.json'), 'utf8')) as {
        entries: unknown[]
    }
    await writeFile(
        join(target, 'meta', '_journal.json'),
        JSON.stringify({ ...journal, entries: journal.entries.slice(0, 1) }),
    )
    return target
}

const LEGACY_CHARACTERS = JSON.stringify([
    { enabled: true, center: { x: 0, y: 0 }, prompt: 'a', uc: '' },
    { enabled: true, center: { x: 0.3, y: 0.7 }, prompt: 'b', uc: '' },
])

function seedLegacyData(sqlite: Database) {
    const now = Date.now()
    sqlite.run(
        `INSERT INTO projects (id, name, prompt, negative_prompt, character_prompts, variables, parameters, settings, created_at, updated_at)
         VALUES (1, 'p', 'prompt', '', '${LEGACY_CHARACTERS}', '[]', '{}', '{}', ${now}, ${now})`,
    )
    sqlite.run(
        `INSERT INTO scenes (id, project_id, name, position, created_at, updated_at) VALUES (1, 1, 's', 'a0', ${now}, ${now})`,
    )
    sqlite.run(
        `INSERT INTO scene_variations (id, scene_id, position, variables, created_at, updated_at) VALUES (10, 1, 'a0', '[]', ${now}, ${now})`,
    )
    sqlite.run(
        `INSERT INTO assets (id, kind, rel_path, content_type, size_bytes, sha256, encrypted, created_at)
         VALUES (1, 'image', 'a.png', 'image/png', 1, 'x', 0, ${now}), (2, 'image_thumb', 'a.webp', 'image/webp', 1, 'x', 0, ${now})`,
    )
    sqlite.run(
        `INSERT INTO images (id, scene_id, position, asset_id, thumb_asset_id, metadata, created_at) VALUES
         (1, 1, 'a0', 1, 2, '{"variationId":10}', ${now}),
         (2, 1, 'a1', 1, 2, '{"variationId":99}', ${now}),
         (3, 1, 'a2', 1, 2, '{}', ${now})`,
    )
    sqlite.run(
        `INSERT INTO stash_items (id, type, name, payload, created_at, updated_at)
         VALUES (1, 'prompt', 'saved', '{"prompt":"x","negativePrompt":"","variables":[],"characterPrompts":${LEGACY_CHARACTERS}}', ${now}, ${now})`,
    )
}

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

    it('upgrades a 0.3.0 database', async () => {
        const path = join(dir, 'v0.3.0.db')
        const legacy = openDatabase({ path, migrationsDir: await initialMigrations() })
        seedLegacyData(legacy.sqlite)
        legacy.sqlite.close()

        const { sqlite } = openDatabase({ path })
        try {
            const variationIds = sqlite
                .query<{ variation_id: number | null }, []>(
                    'SELECT variation_id FROM images ORDER BY id',
                )
                .all()
                .map((row) => row.variation_id)
            expect(variationIds).toEqual([10, null, null])

            type Character = { center: unknown; prompt: string }
            const centersOf = (characters: Character[]) =>
                characters.map((character) => [character.prompt, character.center])
            const expected = [
                ['a', { x: 0.5, y: 0.5 }],
                ['b', { x: 0.3, y: 0.7 }],
            ]
            const project = sqlite
                .query<{ character_prompts: string }, []>('SELECT character_prompts FROM projects')
                .get()
            expect(centersOf(JSON.parse(project!.character_prompts))).toEqual(expected)
            const stash = sqlite
                .query<{ payload: string }, []>('SELECT payload FROM stash_items')
                .get()
            const payload = JSON.parse(stash!.payload) as {
                prompt: string
                characterPrompts: Character[]
            }
            expect(payload.prompt).toBe('x')
            expect(centersOf(payload.characterPrompts)).toEqual(expected)

            sqlite.run('DELETE FROM scene_variations WHERE id = 10')
            const image = sqlite
                .query<{ variation_id: number | null }, []>(
                    'SELECT variation_id FROM images WHERE id = 1',
                )
                .get()
            expect(image?.variation_id).toBeNull()
        } finally {
            sqlite.close()
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
