import { join } from 'node:path'
import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { ImageSettings } from '@/types'

const toFileMock = mock(() => Promise.resolve())

const sharpChain = {
    resize: () => sharpChain,
    png: () => sharpChain,
    webp: () => sharpChain,
    avif: () => sharpChain,
    toFile: toFileMock,
}

mock.module('sharp', () => ({ default: () => sharpChain }))

const mkdirMock = mock(() => Promise.resolve(undefined))
const rmMock = mock(() => Promise.resolve(undefined))

mock.module('fs/promises', () => ({
    default: { mkdir: mkdirMock, rm: rmMock },
}))

const { save, remove, removeByScene, removeByProject, IMAGES_DIR, THUMBNAILS_DIR } =
    await import('./image')

const pngSettings: ImageSettings = {
    sourceType: { type: 'png' },
    thumbnailType: { type: 'webp', quality: 80 },
    thumbnailSize: 256,
}

const imageData = new Uint8Array([1, 2, 3])

describe('save', () => {
    beforeEach(() => {
        mkdirMock.mockClear()
        toFileMock.mockClear()
    })

    it('returns filePath with source extension', async () => {
        const result = await save(1, 2, 3, imageData, pngSettings)

        expect(result.filePath).toEndWith('1/2/3.png')
    })

    it('returns thumbnailPath with thumbnail extension', async () => {
        const result = await save(1, 2, 3, imageData, pngSettings)

        expect(result.thumbnailPath).toEndWith('1/2/3.webp')
    })

    it('creates directories for both image and thumbnail', async () => {
        await save(1, 2, 3, imageData, pngSettings)

        expect(mkdirMock).toHaveBeenCalledTimes(2)
    })

    it('writes image and thumbnail files', async () => {
        await save(1, 2, 3, imageData, pngSettings)

        expect(toFileMock).toHaveBeenCalledTimes(2)
    })

    it('uses forward slashes in returned paths', async () => {
        const result = await save(1, 2, 3, imageData, pngSettings)

        expect(result.filePath).not.toContain('\\')
        expect(result.thumbnailPath).not.toContain('\\')
    })

    it('uses webp extension for webp source type', async () => {
        const webpSettings: ImageSettings = {
            sourceType: { type: 'webp', quality: 90 },
            thumbnailType: { type: 'webp', quality: 80 },
            thumbnailSize: 256,
        }

        const result = await save(1, 2, 3, imageData, webpSettings)

        expect(result.filePath).toEndWith('1/2/3.webp')
    })
})

describe('remove', () => {
    beforeEach(() => {
        rmMock.mockClear()
    })

    it('calls rm for both image and thumbnail paths', async () => {
        await remove('data/images/1/2/3.png', 'data/thumbnails/1/2/3.webp')

        expect(rmMock).toHaveBeenCalledTimes(2)
    })
})

describe('removeByScene', () => {
    beforeEach(() => {
        rmMock.mockClear()
    })

    it('calls rm for image and thumbnail scene directories', async () => {
        await removeByScene(1, 2)

        expect(rmMock).toHaveBeenCalledTimes(2)
    })

    it('deletes correct image scene path recursively', async () => {
        await removeByScene(1, 2)

        expect(rmMock).toHaveBeenCalledWith(join(IMAGES_DIR, '1', '2'), {
            recursive: true,
            force: true,
        })
    })

    it('deletes correct thumbnail scene path recursively', async () => {
        await removeByScene(1, 2)

        expect(rmMock).toHaveBeenCalledWith(join(THUMBNAILS_DIR, '1', '2'), {
            recursive: true,
            force: true,
        })
    })
})

describe('removeByProject', () => {
    beforeEach(() => {
        rmMock.mockClear()
    })

    it('calls rm for both image and thumbnail project directories', async () => {
        await removeByProject(1)

        expect(rmMock).toHaveBeenCalledTimes(2)
    })

    it('deletes correct image project path recursively', async () => {
        await removeByProject(1)

        expect(rmMock).toHaveBeenCalledWith(join(IMAGES_DIR, '1'), {
            recursive: true,
            force: true,
        })
    })

    it('deletes correct thumbnail project path recursively', async () => {
        await removeByProject(1)

        expect(rmMock).toHaveBeenCalledWith(join(THUMBNAILS_DIR, '1'), {
            recursive: true,
            force: true,
        })
    })
})
