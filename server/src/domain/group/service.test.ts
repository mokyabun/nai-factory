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

async function createGroup(name = 'Test Group') {
    return service.create({ name })
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('group service', () => {
    beforeEach(async () => {
        removeByProjectMock.mockClear()
        await testDb.db.delete(testDb.projects).run()
        await testDb.db.delete(testDb.groups).run()
    })

    describe('getAll', () => {
        it('returns empty array when no groups exist', async () => {
            const result = await service.getAll()
            expect(result).toEqual([])
        })

        it('returns all groups ordered by name', async () => {
            await service.create({ name: 'Zebra' })
            await service.create({ name: 'Alpha' })

            const result = await service.getAll()

            expect(result).toHaveLength(2)
            expect(result[0]!.name).toBe('Alpha')
            expect(result[1]!.name).toBe('Zebra')
        })
    })

    describe('getById', () => {
        it('returns the group when found', async () => {
            const created = await createGroup('My Group')
            const result = await service.getById(created!.id)
            expect(result!.name).toBe('My Group')
        })

        it('returns null when group does not exist', async () => {
            const result = await service.getById(9999)
            expect(result).toBeNull()
        })
    })

    describe('create', () => {
        it('creates and returns a new group', async () => {
            const result = await service.create({ name: 'New Group' })
            expect(result!.name).toBe('New Group')
            expect(result!.id).toBeNumber()
        })
    })

    describe('update', () => {
        it('updates the group name', async () => {
            const group = await createGroup()
            const result = await service.update(group!.id, { name: 'Updated' })
            expect(result!.name).toBe('Updated')
        })

        it('returns null when group does not exist', async () => {
            const result = await service.update(9999, { name: 'x' })
            expect(result).toBeNull()
        })
    })

    describe('remove', () => {
        it('returns true and deletes the group', async () => {
            const group = await createGroup()
            const result = await service.remove(group!.id)
            expect(result).toBe(true)

            const found = await service.getById(group!.id)
            expect(found).toBeNull()
        })

        it('returns false when group does not exist', async () => {
            const result = await service.remove(9999)
            expect(result).toBe(false)
        })

        it('calls removeByProject for each child project on deletion', async () => {
            const group = await createGroup()
            await testDb.db
                .insert(testDb.projects)
                .values({ groupId: group!.id, name: 'p1' })
                .run()
            await testDb.db
                .insert(testDb.projects)
                .values({ groupId: group!.id, name: 'p2' })
                .run()

            await service.remove(group!.id)

            expect(removeByProjectMock).toHaveBeenCalledTimes(2)
        })
    })
})
