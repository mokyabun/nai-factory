import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { makeTestDb } from '@/test-utils/db'

// ─── Mock setup ──────────────────────────────────────────────────────────────

mock.restore()
const mkdirSyncMock = mock(() => {})
const writeFileSyncMock = mock(() => {})
const rmMock = mock(async () => {})

mock.module('node:fs', () => ({
    mkdirSync: mkdirSyncMock,
    writeFileSync: writeFileSyncMock,
}))

mock.module('fs/promises', () => ({
    default: { rm: rmMock },
}))

const invalidateVibeMock = mock(async () => {})

mock.module('@/services/vibe-image', () => ({
    invalidateVibe: invalidateVibeMock,
    checkVibe: mock(async () => ({ encodedData: '', referenceStrength: 0.6 })),
    checkVibesForProject: mock(async () => []),
}))

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

async function seedVibe(projectId: number, overrides: Record<string, unknown> = {}) {
    const [v] = await testDb.db
        .insert(testDb.vibeTransfers)
        .values({
            projectId,
            displayOrder: 'a0',
            sourceImagePath: './data/vibes/1/test.png',
            referenceStrength: 0.6,
            informationExtracted: 1.0,
            ...overrides,
        })
        .returning()
    return v!
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('vibe-transfer domain service', () => {
    beforeEach(async () => {
        mkdirSyncMock.mockClear()
        writeFileSyncMock.mockClear()
        rmMock.mockClear()
        invalidateVibeMock.mockClear()
        await testDb.db.delete(testDb.vibeTransfers).run()
        await testDb.db.delete(testDb.projects).run()
        await testDb.db.delete(testDb.groups).run()
    })

    describe('list', () => {
        it('returns empty array when project has no vibe transfers', async () => {
            const { project } = await seedProject()
            const result = await service.list(project.id)
            expect(result).toEqual([])
        })

        it('returns vibes ordered by displayOrder, excludes encodedData', async () => {
            const { project } = await seedProject()
            await seedVibe(project.id, { displayOrder: 'b0', encodedData: 'secret' })
            await seedVibe(project.id, { displayOrder: 'a0' })

            const result = await service.list(project.id)

            expect(result).toHaveLength(2)
            expect(result[0]!.displayOrder).toBe('a0')
            // encodedData is not selected in list
            expect(Object.keys(result[0]!)).not.toContain('encodedData')
        })
    })

    describe('upload', () => {
        it('creates a vibe transfer record and saves the file', async () => {
            const { project } = await seedProject()
            const file = new File([new Uint8Array([1, 2, 3])], 'test.png', { type: 'image/png' })

            const result = await service.upload(project.id, file)

            expect(result.projectId).toBe(project.id)
            expect(result.referenceStrength).toBe(0.6)
            expect(result.informationExtracted).toBe(1.0)
            expect(mkdirSyncMock).toHaveBeenCalled()
            expect(writeFileSyncMock).toHaveBeenCalled()
        })

        it('assigns a fractional displayOrder', async () => {
            const { project } = await seedProject()
            const file1 = new File([new Uint8Array([1])], 'a.png', { type: 'image/png' })
            const file2 = new File([new Uint8Array([2])], 'b.png', { type: 'image/png' })

            const v1 = await service.upload(project.id, file1)
            const v2 = await service.upload(project.id, file2)

            expect(v2.displayOrder > v1.displayOrder).toBe(true)
        })
    })

    describe('update', () => {
        it('returns null when vibe transfer does not exist', async () => {
            const result = await service.update(9999, { referenceStrength: 0.5 })
            expect(result).toBeNull()
        })

        it('updates referenceStrength', async () => {
            const { project } = await seedProject()
            const vibe = await seedVibe(project.id)

            const result = await service.update(vibe.id, { referenceStrength: 0.3 })

            expect(result!.referenceStrength).toBe(0.3)
        })

        it('calls invalidateVibe when informationExtracted changes', async () => {
            const { project } = await seedProject()
            const vibe = await seedVibe(project.id, { informationExtracted: 1.0 })

            await service.update(vibe.id, { informationExtracted: 0.5 })

            expect(invalidateVibeMock).toHaveBeenCalledWith(vibe.id)
        })

        it('does not call invalidateVibe when informationExtracted is unchanged', async () => {
            const { project } = await seedProject()
            const vibe = await seedVibe(project.id, { informationExtracted: 1.0 })

            await service.update(vibe.id, { informationExtracted: 1.0 })

            expect(invalidateVibeMock).not.toHaveBeenCalled()
        })
    })

    describe('reorder', () => {
        it('updates the displayOrder of the specified vibe transfer', async () => {
            const { project } = await seedProject()
            // Use service.upload() so display orders are generated by generateKeyBetween (valid keys)
            const fakeFile = (name: string) =>
                new File([new Uint8Array([1])], name, { type: 'image/png' })
            const v1 = await service.upload(project.id, fakeFile('v1.png'))
            const v2 = await service.upload(project.id, fakeFile('v2.png'))
            const v3 = await service.upload(project.id, fakeFile('v3.png'))

            // Move v3 between v1 and v2
            const result = await service.reorder(v3.id, v1.id, v2.id)

            expect(result!.displayOrder > v1.displayOrder).toBe(true)
            expect(result!.displayOrder < v2.displayOrder).toBe(true)
        })
    })

    describe('remove', () => {
        it('returns false when vibe transfer does not exist', async () => {
            const result = await service.remove(9999)
            expect(result).toBe(false)
        })

        it('returns true and deletes the record', async () => {
            const { eq } = await import('drizzle-orm')
            const { project } = await seedProject()
            const vibe = await seedVibe(project.id)

            const result = await service.remove(vibe.id)

            expect(result).toBe(true)
            const rows = await testDb.db
                .select()
                .from(testDb.vibeTransfers)
                .where(eq(testDb.vibeTransfers.id, vibe.id))
            expect(rows).toHaveLength(0)
        })

        it('calls rm to delete the source image file', async () => {
            const { project } = await seedProject()
            const vibe = await seedVibe(project.id, { sourceImagePath: './data/vibes/1/test.png' })

            await service.remove(vibe.id)

            expect(rmMock).toHaveBeenCalledWith('./data/vibes/1/test.png', { force: true })
        })
    })
})
