import { afterAll, describe, expect, it } from 'bun:test'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { contract } from '@nai-factory/shared'
import { strToU8, unzipSync, zipSync } from 'fflate'

import { createTestApp } from '../helpers/app'
import { createScene, pngFile, runQueue } from '../helpers/fixtures'

const exportDir = await mkdtemp(join(tmpdir(), 'export-test-'))
const t = await createTestApp({ env: { NAI_FACTORY_EXPORT_DIR: exportDir } })
afterAll(async () => {
    await t.close()
    await rm(exportDir, { recursive: true, force: true })
})

async function projectWithImages() {
    const { projectId, scene } = await createScene(t, { poses: ['a', 'b'], prompt: '<<pose>>' })
    await t.call(contract.projects.uploadVibeTransfer, {
        params: { id: projectId },
        body: { image: await pngFile() },
    })
    await t.call(contract.projects.uploadCharacterReference, {
        params: { id: projectId },
        body: { image: await pngFile() },
    })
    await t.call(contract.jobs.enqueueScenes, { body: { sceneIds: [scene.id] } })
    await runQueue(t)
    return { projectId, scene }
}

describe('project archive', () => {
    it('round-trips a project with scenes, images and references', async () => {
        const { projectId } = await projectWithImages()
        const blob = await t.call(contract.projects.exportArchive, {
            params: { id: projectId },
            body: { include: { images: true } },
        })
        const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
        const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']))
        expect(manifest.formatVersion).toBe(3)
        expect(manifest.assets.length).toBe(2 * 2 + 1 + 3)

        const imported = await t.call(contract.projects.importArchive, {
            body: { archive: new File([blob], 'p.naif') },
        })
        expect(imported.id).not.toBe(projectId)
        const scenes = await t.call(contract.scenes.list, { query: { projectId: imported.id } })
        expect(scenes[0]?.imageCount).toBe(2)
        expect(scenes[0]?.variations).toHaveLength(2)
        const vibes = await t.call(contract.projects.vibeTransfers, { params: { id: imported.id } })
        expect(vibes).toHaveLength(1)
        const images = await t.call(contract.images.list, { query: { sceneId: scenes[0]!.id } })
        expect((await t.request(`/api/assets/${images[0]!.assetId}`)).status).toBe(200)
    })

    it('rejects corrupt files and unsafe entry names', async () => {
        const { projectId } = await projectWithImages()
        const blob = await t.call(contract.projects.exportArchive, {
            params: { id: projectId },
            body: { include: { images: true } },
        })
        const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
        const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']))
        const assetPath = manifest.assets[0].path as string
        files[assetPath] = strToU8('tampered')

        const tampered = await t.send(contract.projects.importArchive, {
            body: { archive: new File([zipSync(files)], 'x.naif') },
        })
        expect(tampered.status).toBe(400)

        const escape = await t.send(contract.projects.importArchive, {
            body: {
                archive: new File(
                    [
                        zipSync({
                            'manifest.json': files['manifest.json']!,
                            '../evil.png': strToU8('x'),
                        }),
                    ],
                    'x.naif',
                ),
            },
        })
        expect(escape.status).toBe(400)
    })

    it('enforces the uncompressed size limit', async () => {
        const small = await createTestApp({ env: { NAI_FACTORY_ARCHIVE_MAX_UNCOMPRESSED_MB: '1' } })
        try {
            const bomb = zipSync({ 'assets/image/a1.png': new Uint8Array(2 * 1024 * 1024) })
            const response = await small.send(contract.projects.importArchive, {
                body: { archive: new File([bomb], 'bomb.naif') },
            })
            expect(response.status).toBe(413)
        } finally {
            await small.close()
        }
    })
})

describe('image export', () => {
    it('streams a zip with rendered filenames', async () => {
        const { projectId } = await projectWithImages()
        const blob = await t.call(contract.projects.exportZip, {
            params: { id: projectId },
            body: { imageCount: 5, outputTemplate: '{scene}.{extension}' },
        })
        const names = Object.keys(unzipSync(new Uint8Array(await blob.arrayBuffer())))
        expect(names.sort()).toEqual(['scene-2.png', 'scene.png'])
    })

    it('writes to a folder below NAI_FACTORY_EXPORT_DIR without overwriting files', async () => {
        const { projectId } = await projectWithImages()
        await writeFile(join(exportDir, 'scene.png'), 'existing').catch(() => {})
        const { mkdir } = await import('node:fs/promises')
        await mkdir(join(exportDir, 'out'), { recursive: true })
        await writeFile(join(exportDir, 'out', 'scene-2.png'), 'existing')

        const result = await t.call(contract.projects.exportServer, {
            params: { id: projectId },
            body: { imageCount: 5, outputTemplate: '{scene}.{extension}', folder: 'out' },
        })
        expect(result.exported).toBe(2)
        const files = (await readdir(join(exportDir, 'out'))).sort()
        expect(files).toEqual(['scene-2-2.png', 'scene-2.png', 'scene.png'].sort())
    })
})
