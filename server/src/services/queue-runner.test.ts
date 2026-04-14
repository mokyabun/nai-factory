import { afterAll, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { makeTestDb } from '@/test-utils/db'

// ─── Mock setup ──────────────────────────────────────────────────────────────
// Use spyOn (not mock.module) for service modules so that mock.restore() in
// afterAll properly reverts them — preventing contamination of sibling test
// files (settings.test.ts, vibe-image.test.ts, novelai.test.ts, image.test.ts).

const testDb = makeTestDb()
mock.module('@/db', () => testDb)
afterAll(() => mock.restore())

// Load service modules with @/db already mocked, then spy on specific functions.
const settingsModule = require('./settings') as typeof import('./settings')
const novelaiModule = require('./novelai') as typeof import('./novelai')
const imageModule = require('./image') as typeof import('./image')
const vibeImageModule = require('./vibe-image') as typeof import('./vibe-image')

const getSettingsMock = mock(() => ({
    globalVariables: {} as Record<string, string>,
    novelai: { apiKey: 'test-api-key' },
    image: {
        sourceType: { type: 'png' as const },
        thumbnailType: { type: 'webp' as const, quality: 60 },
        thumbnailSize: 512,
    },
}))

const generateImageMock = mock(async () => ({
    imageData: new Uint8Array([1, 2, 3]),
    seed: 42,
}))

const saveImageMock = mock(async () => ({
    filePath: 'data/images/1/2/3.png',
    thumbnailPath: 'data/thumbnails/1/2/3.webp',
}))

const checkVibesForProjectMock = mock(async () => [] as ReturnType<typeof vibeImageModule.checkVibesForProject> extends Promise<infer T> ? T : never)

spyOn(settingsModule, 'get').mockImplementation(getSettingsMock)
spyOn(novelaiModule, 'generateImage').mockImplementation(generateImageMock)
spyOn(novelaiModule, 'encodeVibe').mockImplementation(mock(async () => ''))
spyOn(novelaiModule, 'validateApiKey').mockImplementation(mock(async () => true))
spyOn(imageModule, 'save').mockImplementation(saveImageMock)
spyOn(imageModule, 'remove').mockImplementation(mock(async () => {}))
spyOn(imageModule, 'removeByScene').mockImplementation(mock(async () => {}))
spyOn(imageModule, 'removeByProject').mockImplementation(mock(async () => {}))
spyOn(vibeImageModule, 'checkVibesForProject').mockImplementation(checkVibesForProjectMock)
spyOn(vibeImageModule, 'checkVibe').mockImplementation(
    mock(async () => ({ encodedData: '', referenceStrength: 0.6 })),
)
spyOn(vibeImageModule, 'invalidateVibe').mockImplementation(mock(async () => {}))

const { runJob } = require('./queue-runner') as typeof import('./queue-runner')

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function seedJobContext(variationCount = 2) {
    const [group] = await testDb.db.insert(testDb.groups).values({ name: 'g' }).returning()
    const [project] = await testDb.db
        .insert(testDb.projects)
        .values({ groupId: group!.id, name: 'p', prompt: '{{style}} cat' })
        .returning()
    const variations = Array.from({ length: variationCount }, (_, i) => ({ style: `style${i}` }))
    const [scene] = await testDb.db
        .insert(testDb.scenes)
        .values({ projectId: project!.id, name: 's', displayOrder: 'a0', variations })
        .returning()
    const [job] = await testDb.db
        .insert(testDb.queueItems)
        .values({
            projectId: project!.id,
            sceneId: scene!.id,
            variationCount,
            sortIndex: Date.now(),
        })
        .returning()
    return { group: group!, project: project!, scene: scene!, job: job! }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('runJob', () => {
    beforeEach(async () => {
        generateImageMock.mockClear()
        saveImageMock.mockClear()
        checkVibesForProjectMock.mockClear()
        await testDb.db.delete(testDb.images).run()
        await testDb.db.delete(testDb.queueItems).run()
        await testDb.db.delete(testDb.scenes).run()
        await testDb.db.delete(testDb.projects).run()
        await testDb.db.delete(testDb.groups).run()
    })

    it('throws when the job does not exist', async () => {
        const gen = runJob(9999)
        await expect(gen.next()).rejects.toThrow('Job 9999 not found')
    })

    it('throws when no API key is configured', async () => {
        getSettingsMock.mockReturnValueOnce({
            globalVariables: {},
            novelai: { apiKey: '' },
            image: {
                sourceType: { type: 'png' },
                thumbnailType: { type: 'webp', quality: 60 },
                thumbnailSize: 512,
            },
        } as ReturnType<typeof getSettingsMock>)

        const { job } = await seedJobContext(1)
        const gen = runJob(job.id)
        await expect(gen.next()).rejects.toThrow('NovelAI API key not set')
    })

    it('calls generateImage once per variation', async () => {
        const { job } = await seedJobContext(2)

        const durations: number[] = []
        for await (const d of runJob(job.id)) {
            durations.push(d)
        }

        expect(generateImageMock).toHaveBeenCalledTimes(2)
        expect(durations).toHaveLength(2)
    })

    it('inserts an image row in the database for each variation', async () => {
        const { job } = await seedJobContext(2)

        for await (const _ of runJob(job.id)) {
            // consume generator
        }

        const images = await testDb.db.select().from(testDb.images)
        expect(images).toHaveLength(2)
        expect(images[0]!.filePath).toBe('data/images/1/2/3.png')
    })

    it('deletes the job row when all variations are processed', async () => {
        const { eq } = await import('drizzle-orm')
        const { job } = await seedJobContext(1)

        for await (const _ of runJob(job.id)) {
            // consume
        }

        const rows = await testDb.db
            .select()
            .from(testDb.queueItems)
            .where(eq(testDb.queueItems.id, job.id))
        expect(rows).toHaveLength(0)
    })

    it('yields a numeric duration for each processed variation', async () => {
        const { job } = await seedJobContext(3)

        const durations: number[] = []
        for await (const d of runJob(job.id)) {
            durations.push(d)
        }

        expect(durations).toHaveLength(3)
        durations.forEach((d) => expect(typeof d).toBe('number'))
    })
})
