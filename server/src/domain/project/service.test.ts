import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { makeTestDb } from '@/test-utils/db'

// ─── Mock setup ──────────────────────────────────────────────────────────────

mock.restore()
const removeByProjectMock = mock(async () => {})

mock.module('@/services/image', () => ({
    save: mock(async () => ({ filePath: '', thumbnailPath: '' })),
    remove: mock(async () => {}),
    removeByScene: mock(async () => {}),
    removeByProject: removeByProjectMock,
}))

const testDb = makeTestDb()

mock.module('@/db', () => testDb)
afterAll(() => mock.restore())

const service = require('./service') as typeof import('./service')

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function seedGroup(name = 'g') {
    const [g] = await testDb.db.insert(testDb.groups).values({ name }).returning()
    return g!
}

async function seedProject(groupId: number, name = 'p') {
    return service.create({ groupId, name })
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('project service', () => {
    beforeEach(async () => {
        removeByProjectMock.mockClear()
        await testDb.db.delete(testDb.projects).run()
        await testDb.db.delete(testDb.groups).run()
    })

    describe('getById', () => {
        it('returns the project when found', async () => {
            const g = await seedGroup()
            const p = await seedProject(g.id, 'My Project')
            const result = await service.getById(p!.id)
            expect(result!.name).toBe('My Project')
        })

        it('returns null when project does not exist', async () => {
            const result = await service.getById(9999)
            expect(result).toBeNull()
        })
    })

    describe('getAllByGroupId', () => {
        it('returns empty array when group has no projects', async () => {
            const g = await seedGroup()
            const result = await service.getAllByGroupId(g.id)
            expect(result).toEqual([])
        })

        it('returns projects ordered by name', async () => {
            const g = await seedGroup()
            await seedProject(g.id, 'Zebra')
            await seedProject(g.id, 'Alpha')

            const result = await service.getAllByGroupId(g.id)

            expect(result).toHaveLength(2)
            expect(result[0]!.name).toBe('Alpha')
            expect(result[1]!.name).toBe('Zebra')
        })

        it('returns only projects belonging to the specified group', async () => {
            const g1 = await seedGroup('g1')
            const g2 = await seedGroup('g2')
            await seedProject(g1.id, 'p1')
            await seedProject(g2.id, 'p2')

            const result = await service.getAllByGroupId(g1.id)

            expect(result).toHaveLength(1)
            expect(result[0]!.name).toBe('p1')
        })
    })

    describe('create', () => {
        it('creates and returns a new project', async () => {
            const g = await seedGroup()
            const result = await service.create({ groupId: g.id, name: 'New' })
            expect(result!.name).toBe('New')
            expect(result!.id).toBeNumber()
        })
    })

    describe('update', () => {
        it('updates project fields', async () => {
            const g = await seedGroup()
            const p = await seedProject(g.id)
            const result = await service.update(p!.id, { name: 'Updated', prompt: 'new prompt' })
            expect(result!.name).toBe('Updated')
            expect(result!.prompt).toBe('new prompt')
        })

        it('returns null when project does not exist', async () => {
            const result = await service.update(9999, { name: 'x' })
            expect(result).toBeNull()
        })
    })

    describe('remove', () => {
        it('returns true and deletes the project', async () => {
            const g = await seedGroup()
            const p = await seedProject(g.id)

            const result = await service.remove(p!.id)

            expect(result).toBe(true)
            expect(await service.getById(p!.id)).toBeNull()
        })

        it('returns false when project does not exist', async () => {
            const result = await service.remove(9999)
            expect(result).toBe(false)
        })

        it('calls removeByProject for the deleted project', async () => {
            const g = await seedGroup()
            const p = await seedProject(g.id)

            await service.remove(p!.id)

            expect(removeByProjectMock).toHaveBeenCalledWith(p!.id)
        })
    })
})
