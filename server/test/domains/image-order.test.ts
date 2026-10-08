import { afterAll, describe, expect, it } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'

const tempDbPath = join(import.meta.dir, `image-order-${Date.now()}.db`)
process.env.DATABASE_URL = tempDbPath

const [{ createApp }, dbModule] = await Promise.all([
    import('../../src/index'),
    import('../../src/db'),
])

const { db, groups, images, projects, scenes } = dbModule

afterAll(async () => {
    await Promise.all([
        rm(tempDbPath, { force: true }),
        rm(`${tempDbPath}-shm`, { force: true }),
        rm(`${tempDbPath}-wal`, { force: true }),
    ])
})

async function seedSceneWithImages() {
    const [group] = await db.insert(groups).values({ name: 'image order group' }).returning()
    if (!group) throw new Error('Failed to seed group')

    const [project] = await db
        .insert(projects)
        .values({ groupId: group.id, name: 'image order project' })
        .returning()
    if (!project) throw new Error('Failed to seed project')

    const [scene] = await db
        .insert(scenes)
        .values({ projectId: project.id, name: 'image order scene', displayOrder: 'a0' })
        .returning()
    if (!scene) throw new Error('Failed to seed scene')

    const imageRows = await db
        .insert(images)
        .values([
            {
                sceneId: scene.id,
                displayOrder: 'c0',
                filePath: 'image-c.png',
                thumbnailPath: 'thumb-c.png',
            },
            {
                sceneId: scene.id,
                displayOrder: 'a0',
                filePath: 'image-a.png',
                thumbnailPath: 'thumb-a.png',
            },
            {
                sceneId: scene.id,
                displayOrder: 'b0',
                filePath: 'image-b.png',
                thumbnailPath: 'thumb-b.png',
            },
        ])
        .returning()

    return { project, scene, images: imageRows }
}

describe('image ordering', () => {
    const app = createApp()

    it('uses the same display order for scene previews and image lists', async () => {
        const { project, scene } = await seedSceneWithImages()

        const scenesResponse = await app.request(`/scenes?projectId=${project.id}`)
        expect(scenesResponse.status).toBe(200)
        const sceneSummaries = (await scenesResponse.json()) as Array<{
            latestImages: Array<{ filePath: string }>
        }>

        const imagesResponse = await app.request(`/images?sceneId=${scene.id}`)
        expect(imagesResponse.status).toBe(200)
        const imageList = (await imagesResponse.json()) as Array<{ filePath: string }>

        expect(sceneSummaries[0]?.latestImages.map((image) => image.filePath)).toEqual([
            'image-a.png',
            'image-b.png',
            'image-c.png',
        ])
        const previewFilePaths = sceneSummaries[0]?.latestImages.map((image) => image.filePath)
        expect(previewFilePaths).toBeDefined()
        expect(imageList.map((image) => image.filePath)).toEqual(previewFilePaths ?? [])
    })

    it('returns the persisted ordered image list after reordering', async () => {
        const { scene, images } = await seedSceneWithImages()
        const imageA = images.find((image) => image.filePath === 'image-a.png')
        const imageC = images.find((image) => image.filePath === 'image-c.png')

        if (!imageA || !imageC) throw new Error('Failed to seed images')

        const reorderResponse = await app.request(`/images/${imageC.id}/order`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ prevId: null, nextId: imageA.id }),
        })
        expect(reorderResponse.status).toBe(200)
        const reordered = (await reorderResponse.json()) as Array<{ filePath: string }>
        expect(reordered.map((image) => image.filePath)).toEqual([
            'image-c.png',
            'image-a.png',
            'image-b.png',
        ])

        const imagesResponse = await app.request(`/images?sceneId=${scene.id}`)
        expect(imagesResponse.status).toBe(200)
        const imageList = (await imagesResponse.json()) as Array<{ filePath: string }>
        expect(imageList.map((image) => image.filePath)).toEqual(
            reordered.map((image) => image.filePath),
        )

        const scenesResponse = await app.request(`/scenes?projectId=${scene.projectId}`)
        expect(scenesResponse.status).toBe(200)
        const sceneSummaries = (await scenesResponse.json()) as Array<{
            latestImages: Array<{ filePath: string }>
        }>
        expect(sceneSummaries[0]?.latestImages.map((image) => image.filePath)).toEqual(
            reordered.map((image) => image.filePath),
        )
    })
})
