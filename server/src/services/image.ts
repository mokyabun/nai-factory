import fs from 'node:fs/promises'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import type { ImageSaveType, ImageSettings } from '@/types'
import baseLogger from '../logger'

const logger = baseLogger.child({ module: 'image-service' })

export const IMAGES_DIR = './data/images'
export const THUMBNAILS_DIR = './data/thumbnails'

async function ensureDirectories(path: string) {
    const dirPath = dirname(path)

    return fs.mkdir(dirPath, { recursive: true })
}

async function generateImage(
    data: Uint8Array,
    filePath: string,
    saveType: ImageSaveType,
    size?: number,
) {
    let image = sharp(data)

    if (size) {
        image = image.resize(size, size, { fit: 'inside' })
    }

    switch (saveType.type) {
        case 'png':
            image = image.png()
            break
        case 'webp':
            image = image.webp({ quality: saveType.quality })
            break
        case 'avif':
            image = image.avif({ quality: saveType.quality })
            break
    }

    await image.toFile(filePath)
}

export async function save(
    projectId: number,
    sceneId: number,
    imageId: number,
    imageData: Uint8Array,
    imageSettings: ImageSettings,
) {
    const imageBasePath = join(String(projectId), String(sceneId), String(imageId))

    const filePath = join(IMAGES_DIR, `${imageBasePath}.${imageSettings.sourceType.type}`)
    const thumbnailPath = join(
        THUMBNAILS_DIR,
        `${imageBasePath}.${imageSettings.thumbnailType.type}`,
    )

    await Promise.all([ensureDirectories(filePath), ensureDirectories(thumbnailPath)])

    const writeFilePromise = generateImage(imageData, filePath, imageSettings.sourceType)
    const thumbnailPromise = generateImage(
        imageData,
        thumbnailPath,
        imageSettings.thumbnailType,
        imageSettings.thumbnailSize,
    )

    await Promise.all([writeFilePromise, thumbnailPromise])

    logger.info({ filePath, sizeBytes: imageData.byteLength }, 'Image saved')

    return {
        filePath: filePath.replaceAll('\\', '/'),
        thumbnailPath: thumbnailPath.replaceAll('\\', '/'),
    }
}

export async function remove(filePath: string, thumbnailPath: string | null) {
    const promises: Promise<void>[] = [fs.rm(filePath, { force: true })]
    if (thumbnailPath) promises.push(fs.rm(thumbnailPath, { force: true }))

    try {
        await Promise.all(promises)
        logger.info({ filePath }, 'Deleted image')
    } catch (error) {
        logger.error({ filePath, err: error }, 'Failed to delete image')
    }
}

export async function removeByScene(projectId: number, sceneId: number) {
    const scenePath = join(IMAGES_DIR, String(projectId), String(sceneId))
    const thumbnailScenePath = join(THUMBNAILS_DIR, String(projectId), String(sceneId))

    try {
        await Promise.all([
            fs.rm(scenePath, { recursive: true, force: true }),
            fs.rm(thumbnailScenePath, { recursive: true, force: true }),
        ])

        logger.info({ projectId, sceneId }, 'Deleted images for scene')
    } catch (error) {
        logger.error({ projectId, sceneId, err: error }, 'Failed to delete images for scene')
    }
}

export async function removeByProject(projectId: number) {
    const projectPath = join(IMAGES_DIR, String(projectId))
    const thumbnailProjectPath = join(THUMBNAILS_DIR, String(projectId))

    try {
        await Promise.all([
            fs.rm(projectPath, { recursive: true, force: true }),
            fs.rm(thumbnailProjectPath, { recursive: true, force: true }),
        ])

        logger.info({ projectId }, 'Deleted images for project')
    } catch (error) {
        logger.error({ projectId, err: error }, 'Failed to delete images for project')
    }
}
