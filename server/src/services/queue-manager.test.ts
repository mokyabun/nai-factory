import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { makeTestDb } from '@/test-utils/db'

// ─── Mock setup ──────────────────────────────────────────────────────────────

mock.restore()
// runJob must be mocked before queue-manager is imported so that processQueue()
// doesn't actually run real generation logic during tests.
const runJobMock = mock(async function* () {
    yield 500
})

mock.module('./queue-runner', () => ({ runJob: runJobMock }))

const testDb = makeTestDb()

mock.module('@/db', () => testDb)
afterAll(() => mock.restore())

const { queueManager } = require('./queue-manager') as typeof import('./queue-manager')

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function seedScene() {
    const [group] = await testDb.db.insert(testDb.groups).values({ name: 'g' }).returning()
    const [project] = await testDb.db
        .insert(testDb.projects)
        .values({ groupId: group!.id, name: 'p' })
        .returning()
    const [scene] = await testDb.db
        .insert(testDb.scenes)
        .values({
            projectId: project!.id,
            name: 's',
            displayOrder: 'a0',
            variations: [{ prompt: 'cat' }],
        })
        .returning()
    return { group: group!, project: project!, scene: scene! }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('queueManager', () => {
    beforeEach(async () => {
        runJobMock.mockClear()
        queueManager.stop()
        await testDb.db.delete(testDb.queueItems).run()
        await testDb.db.delete(testDb.scenes).run()
        await testDb.db.delete(testDb.projects).run()
        await testDb.db.delete(testDb.groups).run()
    })

    describe('add', () => {
        it('inserts a queue item for the scene', async () => {
            const { scene } = await seedScene()

            const item = await queueManager.add(scene.id, 'back')

            expect(item.sceneId).toBe(scene.id)
            expect(item.variationCount).toBe(1) // one variation in test scene
        })

        it('uses positive sortIndex for back position', async () => {
            const { scene } = await seedScene()

            const item = await queueManager.add(scene.id, 'back')

            expect(item.sortIndex).toBeGreaterThan(0)
        })

        it('uses negative sortIndex for front position', async () => {
            const { scene } = await seedScene()

            const item = await queueManager.add(scene.id, 'front')

            expect(item.sortIndex).toBeLessThan(0)
        })

        it('throws when the scene does not exist', async () => {
            await expect(queueManager.add(9999, 'back')).rejects.toThrow('Scene 9999 not found')
        })
    })

    describe('start / stop', () => {
        it('status.running is false before start', async () => {
            const s = await queueManager.status()
            expect(s.running).toBe(false)
        })

        it('start can be called without errors when queue is empty', () => {
            // processQueue() immediately exits when there are no items;
            // we just verify start() itself does not throw
            expect(() => queueManager.start()).not.toThrow()
        })

        it('status.running is false after stop', async () => {
            queueManager.start()
            queueManager.stop()
            const s = await queueManager.status()
            expect(s.running).toBe(false)
        })
    })

    describe('cancel', () => {
        it('removes the specified queue items from the database', async () => {
            const { eq } = await import('drizzle-orm')
            const { scene } = await seedScene()
            const item = await queueManager.add(scene.id, 'back')

            queueManager.cancel([item.id])

            // allow the microtask/.catch to complete
            await new Promise((r) => setTimeout(r, 20))

            const rows = await testDb.db
                .select()
                .from(testDb.queueItems)
                .where(eq(testDb.queueItems.id, item.id))
            expect(rows).toHaveLength(0)
        })
    })

    describe('status', () => {
        it('returns correct pendingCount for enqueued items', async () => {
            const { scene } = await seedScene()
            await queueManager.add(scene.id, 'back')

            const s = await queueManager.status()

            expect(s.pendingCount).toBe(1)
        })

        it('returns null estimatedSeconds when no duration history', async () => {
            const s = await queueManager.status()
            expect(s.estimatedSeconds).toBeNull()
        })
    })
})
