import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { makeTestDb } from '@/test-utils/db'

// ─── Mock setup ──────────────────────────────────────────────────────────────

mock.restore()
const removeFileMock = mock(async () => {})

mock.module('@/services/image', () => ({
    save: mock(async () => ({ filePath: '', thumbnailPath: '' })),
    remove: removeFileMock,
    removeByScene: mock(async () => {}),
    removeByProject: mock(async () => {}),
}))

const testDb = makeTestDb()

mock.module('@/db', () => testDb)
afterAll(() => mock.restore())

const service = require('./service') as typeof import('./service')

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function seedScene() {
    const [g] = await testDb.db.insert(testDb.groups).values({ name: 'g' }).returning()
    const [p] = await testDb.db
        .insert(testDb.projects)
        .values({ groupId: g!.id, name: 'p' })
        .returning()
    const [s] = await testDb.db
        .insert(testDb.scenes)
        .values({ projectId: p!.id, name: 's', displayOrder: 'a0' })
        .returning()
    return { group: g!, project: p!, scene: s! }
}

async function seedImage(sceneId: number, displayOrder = 'a0') {
    const [img] = await testDb.db
        .insert(testDb.images)
        .values({
            sceneId,
            displayOrder,
            filePath: `data/images/1/${sceneId}/1.png`,
            thumbnailPath: `data/thumbnails/1/${sceneId}/1.webp`,
        })
        .returning()
    return img!
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('image domain service', () => {
    beforeEach(async () => {
        removeFileMock.mockClear()
        await testDb.db.delete(testDb.images).run()
        await testDb.db.delete(testDb.scenes).run()
        await testDb.db.delete(testDb.projects).run()
        await testDb.db.delete(testDb.groups).run()
    })

    describe('getAllBySceneId', () => {
        it('returns null when scene does not exist', async () => {
            const result = await service.getAllBySceneId(9999)
            expect(result).toBeNull()
        })

        it('returns empty array when scene has no images', async () => {
            const { scene } = await seedScene()
            const result = await service.getAllBySceneId(scene.id)
            expect(result).toEqual([])
        })

        it('returns images ordered by displayOrder descending', async () => {
            const { scene } = await seedScene()
            await seedImage(scene.id, 'a0')
            await seedImage(scene.id, 'b0')

            const result = await service.getAllBySceneId(scene.id)

            expect(result).toHaveLength(2)
            // desc order: b0 before a0
            expect(result![0]!.displayOrder).toBe('b0')
        })
    })

    describe('remove', () => {
        it('returns null when image does not exist', async () => {
            const result = await service.remove(9999)
            expect(result).toBeNull()
        })

        it('returns true and deletes the image record', async () => {
            const { eq } = await import('drizzle-orm')
            const { scene } = await seedScene()
            const img = await seedImage(scene.id)

            const result = await service.remove(img.id)

            expect(result).toBe(true)
            const rows = await testDb.db
                .select()
                .from(testDb.images)
                .where(eq(testDb.images.id, img.id))
            expect(rows).toHaveLength(0)
        })

        it('calls remove file service for the image and thumbnail', async () => {
            const { scene } = await seedScene()
            const img = await seedImage(scene.id)

            await service.remove(img.id)

            expect(removeFileMock).toHaveBeenCalledWith(img.filePath, img.thumbnailPath)
        })
    })
})
