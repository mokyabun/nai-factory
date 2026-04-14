import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { makeTestDb } from '@/test-utils/db'

// ─── Mock setup (must be before dynamic import) ───────────────────────────────

mock.restore()
const encodeVibeMock = mock(async () => 'encoded-base64-data')
mock.module('./novelai', () => ({ encodeVibe: encodeVibeMock }))

const testDb = makeTestDb()
mock.module('@/db', () => testDb)
afterAll(() => mock.restore())

// `require` is synchronous — prevents other files' mock.module() from interleaving
const {
    checkVibe,
    checkVibesForProject,
    invalidateVibe,
} = require('./vibe-image') as typeof import('./vibe-image')

// ─── BunFile helpers ──────────────────────────────────────────────────────────

const originalBunFile = Bun.file

function mockBunFile(exists: boolean, data = new ArrayBuffer(4)) {
    // @ts-ignore – Bun.file is a global we override in tests
    Bun.file = mock(() => ({
        exists: mock(() => Promise.resolve(exists)),
        arrayBuffer: mock(() => Promise.resolve(data)),
    }))
}

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedProject() {
    const [g] = await testDb.db.insert(testDb.groups).values({ name: 'g' }).returning()
    const [p] = await testDb.db
        .insert(testDb.projects)
        .values({ groupId: g!.id, name: 'p' })
        .returning()
    return { group: g!, project: p! }
}

async function seedVibe(
    projectId: number,
    overrides: Partial<typeof testDb.vibeTransfers.$inferInsert> = {},
) {
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

async function clearAll() {
    await testDb.db.delete(testDb.vibeTransfers).run()
    await testDb.db.delete(testDb.projects).run()
    await testDb.db.delete(testDb.groups).run()
}

// ─── checkVibe ────────────────────────────────────────────────────────────────

describe('checkVibe', () => {
    beforeEach(async () => {
        encodeVibeMock.mockClear()
        mockBunFile(true)
        await clearAll()
    })
    afterEach(() => {
        Bun.file = originalBunFile
    })

    it('throws when the vibe record does not exist', async () => {
        await expect(checkVibe(9999, 'key', 'nai-diffusion-4-5-full')).rejects.toThrow(
            'Vibe transfer 9999 not found',
        )
    })

    it('returns cached data without re-encoding when informationExtracted matches', async () => {
        const { project } = await seedProject()
        const vibe = await seedVibe(project.id, {
            encodedData: 'cached',
            encodedInformationExtracted: 1.0,
            informationExtracted: 1.0,
        })

        const result = await checkVibe(vibe.id, 'key', 'nai-diffusion-4-5-full')

        expect(result.encodedData).toBe('cached')
        expect(encodeVibeMock).not.toHaveBeenCalled()
    })

    it('re-encodes when encodedData is null', async () => {
        const { project } = await seedProject()
        const vibe = await seedVibe(project.id, {
            encodedData: null,
            encodedInformationExtracted: null,
        })

        const result = await checkVibe(vibe.id, 'api-key', 'nai-diffusion-4-5-full')

        expect(encodeVibeMock).toHaveBeenCalledTimes(1)
        expect(result.encodedData).toBe('encoded-base64-data')
    })

    it('re-encodes when encodedInformationExtracted is stale', async () => {
        const { project } = await seedProject()
        const vibe = await seedVibe(project.id, {
            encodedData: 'stale',
            encodedInformationExtracted: 0.5,
            informationExtracted: 1.0,
        })

        await checkVibe(vibe.id, 'api-key', 'nai-diffusion-4-5-full')

        expect(encodeVibeMock).toHaveBeenCalledTimes(1)
    })

    it('throws when source image file does not exist', async () => {
        mockBunFile(false)
        const { project } = await seedProject()
        const vibe = await seedVibe(project.id, {
            encodedData: null,
            encodedInformationExtracted: null,
        })

        await expect(checkVibe(vibe.id, 'key', 'nai-diffusion-4-5-full')).rejects.toThrow(
            'Vibe source image not found',
        )
    })

    it('persists newly encoded data to the database', async () => {
        const { eq } = await import('drizzle-orm')
        const { project } = await seedProject()
        const vibe = await seedVibe(project.id, {
            encodedData: null,
            encodedInformationExtracted: null,
            informationExtracted: 0.8,
        })

        await checkVibe(vibe.id, 'key', 'nai-diffusion-4-5-full')

        const [updated] = await testDb.db
            .select()
            .from(testDb.vibeTransfers)
            .where(eq(testDb.vibeTransfers.id, vibe.id))

        expect(updated!.encodedData).toBe('encoded-base64-data')
        expect(updated!.encodedInformationExtracted).toBe(0.8)
    })
})

// ─── checkVibesForProject ─────────────────────────────────────────────────────

describe('checkVibesForProject', () => {
    beforeEach(async () => {
        encodeVibeMock.mockClear()
        mockBunFile(true)
        await clearAll()
    })
    afterEach(() => {
        Bun.file = originalBunFile
    })

    it('returns empty array when project has no vibe transfers', async () => {
        const { project } = await seedProject()
        const result = await checkVibesForProject(project.id, 'key', 'nai-diffusion-4-5-full')
        expect(result).toEqual([])
    })

    it('returns encoded vibe images for all cached vibes', async () => {
        const { project } = await seedProject()
        await seedVibe(project.id, {
            encodedData: 'enc1',
            encodedInformationExtracted: 1.0,
            referenceStrength: 0.5,
        })
        await seedVibe(project.id, {
            displayOrder: 'b0',
            encodedData: 'enc2',
            encodedInformationExtracted: 1.0,
            referenceStrength: 0.7,
        })

        const result = await checkVibesForProject(project.id, 'key', 'nai-diffusion-4-5-full')

        expect(result).toHaveLength(2)
        expect(result[0]).toMatchObject({ encodedImage: 'enc1', strength: 0.5 })
        expect(result[1]).toMatchObject({ encodedImage: 'enc2', strength: 0.7 })
    })
})

// ─── invalidateVibe ───────────────────────────────────────────────────────────

describe('invalidateVibe', () => {
    beforeEach(async () => {
        await clearAll()
    })

    it('sets encodedData and encodedInformationExtracted to null in the database', async () => {
        const { eq } = await import('drizzle-orm')
        const { project } = await seedProject()
        const vibe = await seedVibe(project.id, {
            encodedData: 'some-data',
            encodedInformationExtracted: 1.0,
        })

        await invalidateVibe(vibe.id)

        const [row] = await testDb.db
            .select()
            .from(testDb.vibeTransfers)
            .where(eq(testDb.vibeTransfers.id, vibe.id))

        expect(row!.encodedData).toBeNull()
        expect(row!.encodedInformationExtracted).toBeNull()
    })
})
