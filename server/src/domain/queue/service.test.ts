import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { makeTestDb } from '@/test-utils/db'

// ─── Mock setup ──────────────────────────────────────────────────────────────

mock.restore()
const addMock = mock(async (sceneId: number, _position: string) => ({
    id: Date.now(),
    sceneId,
    projectId: 1,
    sortIndex: Date.now(),
    variationCount: 1,
}))
const cancelMock = mock(() => {})

mock.module('@/services/queue-manager', () => ({
    queueManager: { add: addMock, cancel: cancelMock },
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

async function seedScene(projectId: number, displayOrder = 'a0') {
    const [s] = await testDb.db
        .insert(testDb.scenes)
        .values({ projectId, name: 's', displayOrder, variations: [{ prompt: 'test' }] })
        .returning()
    return s!
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('queue domain service', () => {
    beforeEach(async () => {
        addMock.mockClear()
        cancelMock.mockClear()
        await testDb.db.delete(testDb.queueItems).run()
        await testDb.db.delete(testDb.scenes).run()
        await testDb.db.delete(testDb.projects).run()
        await testDb.db.delete(testDb.groups).run()
    })

    describe('get', () => {
        it('returns empty array when queue is empty', async () => {
            const result = await service.get()
            expect(result).toEqual([])
        })

        it('filters by projectId when provided', async () => {
            const { project } = await seedProject()
            const scene = await seedScene(project.id)
            await testDb.db
                .insert(testDb.queueItems)
                .values({
                    projectId: project.id,
                    sceneId: scene.id,
                    variationCount: 1,
                    sortIndex: 1,
                })
                .run()

            const allItems = await service.get()
            const filtered = await service.get(project.id)
            const notFound = await service.get(9999)

            expect(allItems).toHaveLength(1)
            expect(filtered).toHaveLength(1)
            expect(notFound).toHaveLength(0)
        })

        it('includes scene name in the results', async () => {
            const { project } = await seedProject()

            const [g2] = await testDb.db.insert(testDb.groups).values({ name: 'g2' }).returning()
            const [p2] = await testDb.db
                .insert(testDb.projects)
                .values({ groupId: g2!.id, name: 'p2' })
                .returning()
            const scene = await seedScene(p2!.id)
            await testDb.db
                .insert(testDb.queueItems)
                .values({
                    projectId: p2!.id,
                    sceneId: scene.id,
                    variationCount: 1,
                    sortIndex: 1,
                })
                .run()

            const result = await service.get()
            expect(result[0]!.sceneName).toBe('s')
        })
    })

    describe('enqueueAll', () => {
        it('throws 404 when project does not exist', async () => {
            await expect(service.enqueueAll(9999)).rejects.toMatchObject({ code: 404 })
        })

        it('calls queueManager.add for each scene in the project', async () => {
            const { project } = await seedProject()
            await seedScene(project.id, 'a0')
            await seedScene(project.id, 'b0')

            const result = await service.enqueueAll(project.id)

            expect(addMock).toHaveBeenCalledTimes(2)
            expect(result.queued).toBe(2)
        })
    })

    describe('cancel', () => {
        it('throws 404 when queue item does not exist', async () => {
            await expect(service.cancel(9999)).rejects.toMatchObject({ code: 404 })
        })

        it('calls queueManager.cancel with the item id', async () => {
            const { project } = await seedProject()
            const scene = await seedScene(project.id)
            const [item] = await testDb.db
                .insert(testDb.queueItems)
                .values({
                    projectId: project.id,
                    sceneId: scene.id,
                    variationCount: 1,
                    sortIndex: 1,
                })
                .returning()

            await service.cancel(item!.id)

            expect(cancelMock).toHaveBeenCalledWith([item!.id])
        })
    })
})
