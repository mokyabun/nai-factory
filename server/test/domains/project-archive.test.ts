import { afterAll, describe, expect, it } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { DEFAULT_PROJECT_PARAMETERS, ProjectArchiveManifest } from '@nai-factory/shared'
import { unzipSync } from 'fflate'

const tempBasePath = join(import.meta.dir, `project-archive-${Date.now()}`)
const tempDbPath = join(tempBasePath, 'database.db')
process.env.DATABASE_URL = tempDbPath
process.env.NAI_FACTORY_DATA_DIR = tempBasePath
process.env.NAI_FACTORY_IMAGES_DIR = join(tempBasePath, 'images')
process.env.NAI_FACTORY_THUMBNAILS_DIR = join(tempBasePath, 'thumbnails')
process.env.NAI_FACTORY_VIBES_DIR = join(tempBasePath, 'vibes')
process.env.NAI_FACTORY_CHARACTER_REFERENCES_DIR = join(tempBasePath, 'character-references')

const [{ createApp }, dbModule, dataStorage] = await Promise.all([
    import('../../src/index'),
    import('../../src/db'),
    import('../../src/data'),
])

const { characterReferences, db, images, projects, scenes, sceneVariations, vibeTransfers } =
    dbModule

afterAll(async () => {
    await rm(tempBasePath, { recursive: true, force: true })
})

async function writeDataFile(path: string) {
    await dataStorage.writeFile(path, new Uint8Array([1, 2, 3, 4]))
    return path
}

describe('project archive export', () => {
    const app = createApp()

    it('downloads a .naif zip containing a versioned manifest and selected assets', async () => {
        const [project] = await db
            .insert(projects)
            .values({
                groupId: null,
                name: 'archive project',
                prompt: 'masterpiece, <<subject>>',
                negativePrompt: 'low quality',
                variables: [{ key: 'subject', value: 'girl' }],
                parameters: { ...DEFAULT_PROJECT_PARAMETERS, width: 832 },
                characterPrompts: [
                    { enabled: true, prompt: 'heroine', uc: 'bad hands', center: { x: 0, y: 0 } },
                ],
            })
            .returning()
        if (!project) throw new Error('Failed to seed project')

        const [scene] = await db
            .insert(scenes)
            .values({ projectId: project.id, displayOrder: 'a0', name: 'scene A' })
            .returning()
        if (!scene) throw new Error('Failed to seed scene')

        await db.insert(sceneVariations).values({
            sceneId: scene.id,
            displayOrder: 'a0',
            variables: [{ key: 'pose', value: 'standing' }],
        })

        const imagePath = await writeDataFile(join(tempBasePath, 'images', 'source.png'))
        const thumbnailPath = await writeDataFile(join(tempBasePath, 'thumbnails', 'source.webp'))
        await db.insert(images).values({
            sceneId: scene.id,
            displayOrder: 'a0',
            filePath: imagePath,
            thumbnailPath,
            metadata: { seed: 123 },
        })

        const referencePath = await writeDataFile(
            join(tempBasePath, 'character-references', 'ref.png'),
        )
        const referenceThumbnailPath = await writeDataFile(
            join(tempBasePath, 'character-references', 'ref-thumb.png'),
        )
        const referenceProcessedPath = await writeDataFile(
            join(tempBasePath, 'character-references', 'ref-processed.png'),
        )
        await db.insert(characterReferences).values({
            projectId: project.id,
            displayOrder: 'a0',
            sourceImagePath: referencePath,
            thumbnailPath: referenceThumbnailPath,
            processedImagePath: referenceProcessedPath,
            strength: 0.7,
            fidelity: 0.4,
            referenceMode: 'character&style',
            enabled: true,
        })

        const vibePath = await writeDataFile(join(tempBasePath, 'vibes', 'vibe.png'))
        await db.insert(vibeTransfers).values({
            projectId: project.id,
            displayOrder: 'a0',
            sourceImagePath: vibePath,
            referenceStrength: 0.5,
            informationExtracted: 0.9,
            encodedData: 'encoded-vibe',
            encodedInformationExtracted: 0.9,
        })

        const response = await app.request(`/projects/${project.id}/archive`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                include: {
                    images: true,
                    thumbnails: true,
                    derivedCaches: true,
                },
            }),
        })

        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toContain(
            'application/vnd.nai-factory.project+zip',
        )
        expect(response.headers.get('content-disposition')).toContain('.naif')

        const entries = unzipSync(new Uint8Array(await response.arrayBuffer()))
        const manifestEntry = entries['manifest.json']
        expect(manifestEntry).toBeDefined()

        const manifest = ProjectArchiveManifest.parse(
            JSON.parse(new TextDecoder().decode(manifestEntry)),
        )

        expect(manifest).toMatchObject({
            format: 'nai-factory.project',
            formatVersion: 1,
            project: {
                name: 'archive project',
                prompt: 'masterpiece, <<subject>>',
                negativePrompt: 'low quality',
            },
            include: {
                images: true,
                thumbnails: true,
                derivedCaches: true,
            },
        })
        expect(manifest.scenes).toHaveLength(1)
        expect(manifest.scenes[0]?.variations).toHaveLength(1)
        expect(manifest.scenes[0]?.images).toHaveLength(1)
        expect(manifest.characterReferences).toHaveLength(1)
        expect(manifest.vibeTransfers).toHaveLength(1)
        expect(manifest.vibeTransfers[0]?.encodedData).toBe('encoded-vibe')

        const assetKinds = manifest.assets.map((asset) => asset.kind)
        expect(assetKinds).toContain('image')
        expect(assetKinds).toContain('image-thumbnail')
        expect(assetKinds).toContain('character-reference-source')
        expect(assetKinds).toContain('character-reference-thumbnail')
        expect(assetKinds).toContain('character-reference-processed')
        expect(assetKinds).toContain('vibe-source')

        for (const asset of manifest.assets) {
            expect(entries[asset.path]).toBeDefined()
        }
    })
})
