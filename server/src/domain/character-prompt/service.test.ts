import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { makeTestDb } from '@/test-utils/db'

// ─── Mock setup ──────────────────────────────────────────────────────────────

mock.restore()
const testDb = makeTestDb()

mock.module('@/db', () => testDb)
afterAll(() => mock.restore())

const service = require('./service') as typeof import('./service')

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function seedProject() {
    const [g] = await testDb.db.insert(testDb.groups).values({ name: 'g' }).returning()
    const [p] = await testDb.db
        .insert(testDb.projects)
        .values({ groupId: g!.id, name: 'p' })
        .returning()
    return { group: g!, project: p! }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('character-prompt service', () => {
    beforeEach(async () => {
        await testDb.db.delete(testDb.projects).run()
        await testDb.db.delete(testDb.groups).run()
    })

    describe('list', () => {
        it('throws 404 when project does not exist', async () => {
            await expect(service.list(9999)).rejects.toMatchObject({ code: 404 })
        })

        it('returns empty array when project has no character prompts', async () => {
            const { project } = await seedProject()
            const result = await service.list(project.id)
            expect(result).toEqual([])
        })
    })

    describe('create', () => {
        it('appends a new character prompt with defaults', async () => {
            const { project } = await seedProject()

            const result = await service.create(project.id, {})

            expect(result).toHaveLength(1)
            expect(result![0]).toMatchObject({
                enabled: true,
                center: { x: 0.5, y: 0.5 },
                prompt: '',
                uc: '',
            })
        })

        it('uses provided values instead of defaults', async () => {
            const { project } = await seedProject()

            const result = await service.create(project.id, {
                enabled: false,
                center: { x: 0.1, y: 0.9 },
                prompt: 'a cat',
                uc: 'bad',
            })

            expect(result![0]).toMatchObject({
                enabled: false,
                center: { x: 0.1, y: 0.9 },
                prompt: 'a cat',
                uc: 'bad',
            })
        })

        it('appends to existing character prompts', async () => {
            const { project } = await seedProject()
            await service.create(project.id, { prompt: 'first' })
            const result = await service.create(project.id, { prompt: 'second' })
            expect(result).toHaveLength(2)
        })
    })

    describe('update', () => {
        it('throws 404 when project does not exist', async () => {
            await expect(service.update(9999, 0, { prompt: 'x' })).rejects.toMatchObject({
                code: 404,
            })
        })

        it('throws 404 when index is out of bounds', async () => {
            const { project } = await seedProject()
            await service.create(project.id, {})

            await expect(service.update(project.id, 5, { prompt: 'x' })).rejects.toMatchObject({
                code: 404,
            })
        })

        it('updates the character prompt at the given index', async () => {
            const { project } = await seedProject()
            await service.create(project.id, { prompt: 'original' })

            const result = await service.update(project.id, 0, { prompt: 'updated' })

            expect(result![0]!.prompt).toBe('updated')
        })
    })

    describe('remove', () => {
        it('throws 404 when index is out of bounds', async () => {
            const { project } = await seedProject()
            await service.create(project.id, {})

            await expect(service.remove(project.id, 5)).rejects.toMatchObject({ code: 404 })
        })

        it('removes the character prompt at the given index', async () => {
            const { project } = await seedProject()
            await service.create(project.id, { prompt: 'a' })
            await service.create(project.id, { prompt: 'b' })

            const result = await service.remove(project.id, 0)

            expect(result).toHaveLength(1)
            expect(result![0]!.prompt).toBe('b')
        })
    })
})
