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

async function seedScene(
    projectId: number,
    name = 's',
    displayOrder = 'a0',
    variations = [{ prompt: 'cat' }],
) {
    const [scene] = await testDb.db
        .insert(testDb.scenes)
        .values({ projectId, name, displayOrder, variations })
        .returning()
    return scene!
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('scene service', () => {
    beforeEach(async () => {
        await testDb.db.delete(testDb.images).run()
        await testDb.db.delete(testDb.vibeTransfers).run()
        await testDb.db.delete(testDb.scenes).run()
        await testDb.db.delete(testDb.projects).run()
        await testDb.db.delete(testDb.groups).run()
    })

    describe('get', () => {
        it('throws 404 when project does not exist', async () => {
            await expect(service.get(9999)).rejects.toMatchObject({ code: 404 })
        })

        it('returns scenes ordered by displayOrder', async () => {
            const { project } = await seedProject()
            await seedScene(project.id, 'S2', 'b0')
            await seedScene(project.id, 'S1', 'a0')

            const result = await service.get(project.id)

            expect(result).toHaveLength(2)
            expect(result[0]!.name).toBe('S1')
            expect(result[1]!.name).toBe('S2')
        })
    })

    describe('getById', () => {
        it('throws 404 when scene does not exist', async () => {
            await expect(service.getById(9999)).rejects.toMatchObject({ code: 404 })
        })

        it('returns the scene with an images array', async () => {
            const { project } = await seedProject()
            const scene = await seedScene(project.id)

            const result = await service.getById(scene.id)

            expect(result.name).toBe('s')
            expect(result.images).toEqual([])
        })
    })

    describe('getWorkspaceData', () => {
        it('throws 404 when project does not exist', async () => {
            await expect(service.getWorkspaceData(9999)).rejects.toMatchObject({ code: 404 })
        })

        it('returns project with vibeTransfers excluding encodedData', async () => {
            const { project } = await seedProject()

            const result = await service.getWorkspaceData(project.id)

            expect(result.id).toBe(project.id)
            expect(result.vibeTransfers).toEqual([])
            // encodedData should not be present in vibeTransfers
            expect(Object.keys(result)).not.toContain('encodedData')
        })
    })

    describe('create', () => {
        it('throws 404 when project does not exist', async () => {
            await expect(service.create(9999, 'New Scene')).rejects.toMatchObject({ code: 404 })
        })

        it('creates a new scene with a displayOrder', async () => {
            const { project } = await seedProject()

            const result = await service.create(project.id, 'My Scene')

            expect(result!.name).toBe('My Scene')
            expect(result!.displayOrder).toBeTruthy()
        })

        it('appends scene after existing scenes in order', async () => {
            const { project } = await seedProject()
            const first = await service.create(project.id, 'First')
            const second = await service.create(project.id, 'Second')

            expect(second!.displayOrder > first!.displayOrder).toBe(true)
        })
    })

    describe('update', () => {
        it('throws 404 when scene does not exist', async () => {
            await expect(service.update(9999, { name: 'x' })).rejects.toMatchObject({ code: 404 })
        })

        it('updates scene name and variations', async () => {
            const { project } = await seedProject()
            const scene = await seedScene(project.id)

            const result = await service.update(scene.id, {
                name: 'Updated',
                variations: [{ prompt: 'dog' }],
            })

            expect(result!.name).toBe('Updated')
            expect(result!.variations).toEqual([{ prompt: 'dog' }])
        })
    })

    describe('reorder', () => {
        it('throws 404 when scene does not exist', async () => {
            await expect(service.reorder(9999, null, null)).rejects.toMatchObject({ code: 404 })
        })

        it('updates displayOrder of the scene', async () => {
            const { project } = await seedProject()
            // Use service.create() to get valid fractional indexing keys
            const s1 = await service.create(project.id, 'S1')
            const s2 = await service.create(project.id, 'S2')
            const s3 = await service.create(project.id, 'S3')

            // Move s3 between s1 and s2
            const result = await service.reorder(s3!.id, s1!.id, s2!.id)

            expect(result!.displayOrder > s1!.displayOrder).toBe(true)
            expect(result!.displayOrder < s2!.displayOrder).toBe(true)
        })
    })

    describe('remove', () => {
        it('throws 404 when scene does not exist', async () => {
            await expect(service.remove(9999)).rejects.toMatchObject({ code: 404 })
        })

        it('removes the scene and returns success', async () => {
            const { eq } = await import('drizzle-orm')
            const { project } = await seedProject()
            const scene = await seedScene(project.id)

            const result = await service.remove(scene.id)

            expect(result).toEqual({ success: true })

            const rows = await testDb.db
                .select()
                .from(testDb.scenes)
                .where(eq(testDb.scenes.id, scene.id))
            expect(rows).toHaveLength(0)
        })
    })
})
