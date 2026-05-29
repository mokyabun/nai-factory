import fs from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ImageSaveType, ImageSettings } from '@nai-factory/shared'
import sharp from 'sharp'
import { IMAGES_DIR, THUMBNAILS_DIR } from '#/config'
import baseLogger from '#/logger'

const logger = baseLogger.child({ module: 'image-service' })

export { IMAGES_DIR, THUMBNAILS_DIR }

async function ensureDir(path: string) {
    return fs.mkdir(dirname(path), { recursive: true })
}

async function processImage(
    data: Uint8Array,
    filePath: string,
    saveType: ImageSaveType,
    metadata?: Record<string, unknown>,
    size?: number,
) {
    let image = sharp(data)

    if (size) image = image.resize(size, size, { fit: 'inside' })

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

    if (metadata) {
        const serialized = JSON.stringify(metadata)
        image = image
            .withExif({
                IFD0: {
                    Software: 'NAI Factory',
                    ImageDescription: serialized,
                },
            })
            .withXmp(createXmpPacket(serialized))
    }

    await image.toFile(filePath)
}

function escapeXml(value: string) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;')
}

function createXmpPacket(serializedMetadata: string) {
    const escaped = escapeXml(serializedMetadata)

    return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:nai="https://nai-factory.local/metadata/1.0/">
      <dc:description><rdf:Alt><rdf:li xml:lang="x-default">${escaped}</rdf:li></rdf:Alt></dc:description>
      <nai:metadata>${escaped}</nai:metadata>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`
}

export async function save(
    projectId: number,
    sceneId: number,
    imageId: number,
    imageData: Uint8Array,
    imageSettings: ImageSettings,
    metadata?: Record<string, unknown>,
) {
    const base = join(String(projectId), String(sceneId), String(imageId))
    const filePath = join(IMAGES_DIR, `${base}.${imageSettings.sourceType.type}`)
    const thumbnailPath = join(THUMBNAILS_DIR, `${base}.${imageSettings.thumbnailType.type}`)

    await Promise.all([ensureDir(filePath), ensureDir(thumbnailPath)])

    await Promise.all([
        processImage(imageData, filePath, imageSettings.sourceType, metadata),
        processImage(
            imageData,
            thumbnailPath,
            imageSettings.thumbnailType,
            undefined,
            imageSettings.thumbnailSize,
        ),
    ])

    logger.info({ filePath, sizeBytes: imageData.byteLength }, 'Image saved')

    return {
        filePath: filePath.replaceAll('\\', '/'),
        thumbnailPath: thumbnailPath.replaceAll('\\', '/'),
    }
}

export async function savePlayground(
    imageId: number,
    imageData: Uint8Array,
    imageSettings: ImageSettings,
    metadata?: Record<string, unknown>,
) {
    const base = join('playground', String(imageId))
    const filePath = join(IMAGES_DIR, `${base}.${imageSettings.sourceType.type}`)
    const thumbnailPath = join(THUMBNAILS_DIR, `${base}.${imageSettings.thumbnailType.type}`)

    await Promise.all([ensureDir(filePath), ensureDir(thumbnailPath)])

    await Promise.all([
        processImage(imageData, filePath, imageSettings.sourceType, metadata),
        processImage(
            imageData,
            thumbnailPath,
            imageSettings.thumbnailType,
            undefined,
            imageSettings.thumbnailSize,
        ),
    ])

    logger.info({ filePath, sizeBytes: imageData.byteLength }, 'Playground image saved')

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
