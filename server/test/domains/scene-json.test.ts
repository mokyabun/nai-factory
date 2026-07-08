import { afterAll, describe, expect, it } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'

const tempBasePath = join(import.meta.dir, `scene-json-${Date.now()}`)
const tempDbPath = join(tempBasePath, 'database.db')
process.env.DATABASE_URL = tempDbPath
process.env.NAI_FACTORY_DATA_DIR = tempBasePath
process.env.NAI_FACTORY_IMAGES_DIR = join(tempBasePath, 'images')
process.env.NAI_FACTORY_THUMBNAILS_DIR = join(tempBasePath, 'thumbnails')

const [{ createApp }, dbModule] = await Promise.all([
    import('../../src/index'),
    import('../../src/db'),
])

const { db, projects, scenes, sceneVariations } = dbModule

afterAll(async () => {
    await rm(tempBasePath, { recursive: true, force: true })
})

async function seedProject(name: string) {
    const [project] = await db.insert(projects).values({ groupId: null, name }).returning()
    if (!project) throw new Error('Failed to seed project')
    return project
}

async function seedScene(projectId: number, name: string, order: string, value: string) {
    const [scene] = await db
        .insert(scenes)
        .values({ projectId, name, displayOrder: order })
        .returning()
    if (!scene) throw new Error('Failed to seed scene')

    await db.insert(sceneVariations).values({
        sceneId: scene.id,
        displayOrder: order,
        variables: [{ key: 'pose', value }],
    })

    return scene
}

describe('scene JSON domain', () => {
    const app = createApp()

    it('exports scene-only JSON and imports it into an existing project', async () => {
        const source = await seedProject('source')
        const target = await seedProject('target')
        await seedScene(source.id, 'scene A', 'a0', 'standing')
        const selectedScene = await seedScene(source.id, 'scene B', 'a1', 'sitting')

        const exportResponse = await app.request('/scenes/export-json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: source.id, sceneIds: [selectedScene.id] }),
        })

        expect(exportResponse.status).toBe(200)
        const exported = (await exportResponse.json()) as {
            scenes: Array<{
                name: string
                displayOrder?: string
                variations: Array<{
                    displayOrder?: string
                    variables: Array<{ key: string; value: string }>
                }>
            }>
        }

        expect(exported.scenes).toHaveLength(1)
        expect(exported.scenes[0]?.name).toBe('scene B')
        expect(exported.scenes[0]?.displayOrder).toBeUndefined()
        expect(exported.scenes[0]?.variations[0]?.displayOrder).toBeUndefined()
        expect(exported.scenes[0]?.variations[0]?.variables).toEqual([
            { key: 'pose', value: 'sitting' },
        ])

        const importResponse = await app.request('/scenes/import-json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: target.id, data: exported }),
        })

        expect(importResponse.status).toBe(201)
        expect(await importResponse.json()).toMatchObject({ imported: 1 })

        const targetScenesResponse = await app.request(`/scenes?projectId=${target.id}`)
        const targetScenes = (await targetScenesResponse.json()) as Array<{
            name: string
            variations: Array<{ variables: Array<{ key: string; value: string }> }>
        }>

        expect(targetScenes).toHaveLength(1)
        expect(targetScenes[0]?.name).toBe('scene B')
        expect(targetScenes[0]?.variations[0]?.variables).toEqual([
            { key: 'pose', value: 'sitting' },
        ])
    })
})
