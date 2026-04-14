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

const validSdStudioData = {
    name: 'Test Pack',
    scenes: {
        s1: {
            name: 'Scene 1',
            slots: [[{ prompt: 'cat', enabled: true }]],
        },
        s2: {
            name: 'Scene 2',
            slots: [[{ prompt: 'dog' }, { prompt: 'bird' }]],
        },
    },
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('sd-studio domain service', () => {
    beforeEach(async () => {
        await testDb.db.delete(testDb.scenes).run()
        await testDb.db.delete(testDb.projects).run()
        await testDb.db.delete(testDb.groups).run()
    })

    describe('importToProject', () => {
        it('throws 404 when project does not exist', async () => {
            await expect(service.importToProject(9999, validSdStudioData)).rejects.toMatchObject({
                code: 404,
            })
        })

        it('throws on invalid SD Studio file data', async () => {
            const { project } = await seedProject()
            await expect(service.importToProject(project.id, { bad: 'data' })).rejects.toThrow(
                'Invalid SD Studio file',
            )
        })

        it('returns the count of imported scenes', async () => {
            const { project } = await seedProject()

            const result = await service.importToProject(project.id, validSdStudioData)

            expect(result.imported).toBe(2)
            expect(result.scenes).toHaveLength(2)
        })

        it('creates scene rows with correct names and variations', async () => {
            const { project } = await seedProject()

            const result = await service.importToProject(project.id, validSdStudioData)

            const names = result.scenes.map((s) => s.name)
            expect(names).toContain('Scene 1')
            expect(names).toContain('Scene 2')

            const scene1 = result.scenes.find((s) => s.name === 'Scene 1')!
            expect(scene1.variations).toEqual([{ prompt: 'cat' }])

            const scene2 = result.scenes.find((s) => s.name === 'Scene 2')!
            expect(scene2.variations).toHaveLength(2)
        })

        it('appends scenes after existing ones using fractional ordering', async () => {
            const { project } = await seedProject()
            // Seed an existing scene
            const [existing] = await testDb.db
                .insert(testDb.scenes)
                .values({ projectId: project.id, name: 'existing', displayOrder: 'a0' })
                .returning()

            const result = await service.importToProject(project.id, {
                name: 'pack',
                scenes: { s1: { name: 'New Scene', slots: [[{ prompt: 'x' }]] } },
            })

            // New scene must come after the existing one
            expect(result.scenes[0]!.displayOrder > existing!.displayOrder).toBe(true)
        })
    })
})
