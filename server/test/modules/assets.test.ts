import { afterAll, describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { utimes, writeFile, mkdir } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'

import { assetPath, contract } from '@nai-factory/shared'

import { assets as assetsTable } from '@/db'
import * as assets from '@/modules/assets/service'

import { createTestApp } from '../helpers/app'
import { createScene, pngFile, runQueue } from '../helpers/fixtures'

const t = await createTestApp({ inMemory: false })
afterAll(() => t.close())

describe('B1: images are served by asset id', () => {
    it('works with an absolute data folder', async () => {
        expect(isAbsolute(t.config.dataDir)).toBe(true)
        const { scene } = await createScene(t)
        await t.call(contract.jobs.enqueueScenes, { body: { sceneIds: [scene.id] } })
        await runQueue(t)

        const [image] = await t.call(contract.images.list, { query: { sceneId: scene.id } })
        expect(image).toBeDefined()
        const row = t.ctx.db
            .select()
            .from(assetsTable)
            .all()
            .find((asset) => asset.id === image!.assetId)
        expect(row?.relPath.startsWith('images/')).toBe(true)
        expect(isAbsolute(row!.relPath)).toBe(false)

        const response = await t.request(assetPath(image!.assetId))
        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toBe('image/png')
        expect(response.headers.get('cache-control')).toContain('immutable')
        const etag = response.headers.get('etag')
        expect(etag).toMatch(/^"[a-f0-9]{64}"$/)

        const cached = await t.request(assetPath(image!.assetId), {
            headers: { 'if-none-match': etag! },
        })
        expect(cached.status).toBe(304)

        const thumb = await t.request(assetPath(image!.thumbAssetId))
        expect(thumb.headers.get('content-type')).toBe('image/webp')
    })
})

describe('uploads', () => {
    it('stores references with their thumbnails', async () => {
        const { projectId } = await createScene(t)
        const ref = await t.call(contract.projects.uploadCharacterReference, {
            params: { id: projectId },
            body: { image: await pngFile() },
        })
        expect(ref.thumbAssetId).not.toBeNull()
        expect((await t.request(assetPath(ref.sourceAssetId))).status).toBe(200)
    })

    it('rejects files that are not images', async () => {
        const { projectId } = await createScene(t)
        const response = await t.send(contract.projects.uploadVibeTransfer, {
            params: { id: projectId },
            body: { image: new File(['<svg/>'], 'x.png', { type: 'image/png' }) },
        })
        expect(response.status).toBe(415)
    })
})

describe('deletion and GC', () => {
    it('removes image files when their scene is deleted', async () => {
        const { scene } = await createScene(t)
        await t.call(contract.jobs.enqueueScenes, { body: { sceneIds: [scene.id] } })
        await runQueue(t)
        const [image] = await t.call(contract.images.list, { query: { sceneId: scene.id } })
        const row = assets.get(t.ctx, image!.assetId)!
        expect(existsSync(t.ctx.paths.resolve(row.relPath))).toBe(true)

        await t.call(contract.scenes.delete, { params: { id: scene.id } })
        expect(assets.get(t.ctx, image!.assetId)).toBeNull()
        expect(existsSync(t.ctx.paths.resolve(row.relPath))).toBe(false)
    })

    it('collects unreferenced rows and stray files but keeps referenced ones', async () => {
        const { projectId } = await createScene(t)
        const ref = await t.call(contract.projects.uploadVibeTransfer, {
            params: { id: projectId },
            body: { image: await pngFile() },
        })

        const orphanRow = assets.insertPrepared(t.ctx.db, {
            kind: 'image',
            relPath: 'images/orphan.png',
            contentType: 'image/png',
            sizeBytes: 1,
            width: null,
            height: null,
            sha256: 'x'.repeat(64),
            encrypted: false,
        })
        await writeFile(t.ctx.paths.resolve('images/orphan.png'), 'x')

        const stray = t.ctx.paths.resolve('images/stray/old.png')
        await mkdir(join(stray, '..'), { recursive: true })
        await writeFile(stray, 'x')
        const old = new Date(Date.now() - assets.GC_GRACE_MS - 1000)
        await utimes(stray, old, old)
        const fresh = t.ctx.paths.resolve('images/stray/new.png')
        await writeFile(fresh, 'x')

        const report = await t.call(contract.debug.gc)
        expect(report.dryRun).toBe(true)
        expect(report.orphanAssets.map((asset) => asset.id)).toContain(orphanRow.id)
        expect(report.orphanFiles).toContain('images/stray/old.png')
        expect(report.orphanFiles).not.toContain('images/stray/new.png')

        await t.call(contract.debug.gc, { query: { apply: true } })
        expect(assets.get(t.ctx, orphanRow.id)).toBeNull()
        expect(existsSync(stray)).toBe(false)
        expect(existsSync(fresh)).toBe(true)
        expect(assets.get(t.ctx, ref.sourceAssetId)).not.toBeNull()
    })
})
