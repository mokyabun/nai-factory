import { afterAll, describe, expect, it } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { DEFAULT_PROJECT_PARAMETERS } from '@nai-factory/shared'
import { eq } from 'drizzle-orm'

const tempBasePath = join(import.meta.dir, `stash-${Date.now()}`)
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
        displayOrder: '00000000',
        variables: [{ key: 'pose', value }],
    })

    return scene
}

describe('stash domain', () => {
    const app = createApp()

    it('stores reusable prompt, scene, and parameter items across projects', async () => {
        const source = await seedProject('source')
        const target = await seedProject('target')
        await db
            .update(projects)
            .set({
                prompt: 'masterpiece, <<prompt>>',
                negativePrompt: 'low quality',
                variables: [{ key: 'prompt', value: 'girl' }],
                parameters: { ...DEFAULT_PROJECT_PARAMETERS, width: 832, height: 1216 },
            })
            .where(eq(projects.id, source.id))
        await seedScene(source.id, 'scene A', 'a0', 'standing')

        const captureResponse = await app.request('/stash/capture-scenes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: source.id }),
        })
        expect(captureResponse.status).toBe(200)
        const scenePayload = await captureResponse.json()

        const sceneStashResponse = await app.request('/stash', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'scene',
                name: 'source scenes',
                payload: scenePayload,
            }),
        })
        expect(sceneStashResponse.status).toBe(201)
        const sceneStash = (await sceneStashResponse.json()) as { id: number }

        const applySceneResponse = await app.request(`/stash/${sceneStash.id}/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: target.id, mode: 'replace' }),
        })
        expect(applySceneResponse.status).toBe(200)
        expect(await applySceneResponse.json()).toEqual({ applied: true, imported: 1 })

        const targetScenesResponse = await app.request(`/scenes?projectId=${target.id}`)
        const targetScenes = (await targetScenesResponse.json()) as Array<{
            name: string
            variations: Array<{ variables: Array<{ key: string; value: string }> }>
        }>
        expect(targetScenes).toHaveLength(1)
        expect(targetScenes[0]?.name).toBe('scene A')
        expect(targetScenes[0]?.variations[0]?.variables).toEqual([
            { key: 'pose', value: 'standing' },
        ])

        const promptStashResponse = await app.request('/stash', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'prompt',
                name: 'prompt stack',
                payload: {
                    prompt: 'masterpiece, <<prompt>>',
                    negativePrompt: 'low quality',
                    variables: [{ key: 'prompt', value: 'girl' }],
                    characterPrompts: [],
                },
            }),
        })
        const promptStash = (await promptStashResponse.json()) as { id: number }
        const applyPromptResponse = await app.request(`/stash/${promptStash.id}/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: target.id }),
        })
        expect(applyPromptResponse.status).toBe(200)

        const paramsStashResponse = await app.request('/stash', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'parameters',
                name: 'portrait params',
                payload: { ...DEFAULT_PROJECT_PARAMETERS, width: 832, height: 1216 },
            }),
        })
        const paramsStash = (await paramsStashResponse.json()) as { id: number }
        const applyParamsResponse = await app.request(`/stash/${paramsStash.id}/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: target.id }),
        })
        expect(applyParamsResponse.status).toBe(200)

        const targetProjectResponse = await app.request(`/projects/${target.id}`)
        expect(await targetProjectResponse.json()).toMatchObject({
            prompt: 'masterpiece, <<prompt>>',
            negativePrompt: 'low quality',
            variables: [{ key: 'prompt', value: 'girl' }],
            parameters: { width: 832, height: 1216 },
        })
    })
})
