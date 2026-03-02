import fs from 'fs/promises'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import logger from '@/logger'

export const IMAGES_DIR = './data/images'
export const THUMBNAILS_DIR = './data/thumbnails'

class ImageService {
    private readonly log = logger.child({ module: 'image' })

    async saveImage(
        groupId: number,
        projectId: number,
        sceneId: number,
        imageId: number,
        imageData: Uint8Array,
    ): Promise<{ filePath: string; thumbnailPath: string }> {
        const relativePath = join(
            String(groupId),
            String(projectId),
            String(sceneId),
            `${imageId}.png`,
        )
        const filePath = join(IMAGES_DIR, relativePath)
        const thumbnailPath = join(THUMBNAILS_DIR, relativePath)

        mkdirSync(dirname(filePath), { recursive: true })
        mkdirSync(dirname(thumbnailPath), { recursive: true })

        writeFileSync(filePath, imageData)
        this.log.info({ filePath, sizeBytes: imageData.byteLength }, 'Image saved')

        await this.generateThumbnail(filePath, thumbnailPath)

        return {
            filePath: filePath.replaceAll('\\', '/'),
            thumbnailPath: thumbnailPath.replaceAll('\\', '/'),
        }
    }

    async deleteByGroup(groupId: number): Promise<void> {
        await Promise.all([
            this.deleteDirectory(join(IMAGES_DIR, String(groupId))),
            this.deleteDirectory(join(THUMBNAILS_DIR, String(groupId))),
        ]).catch((err) => this.log.error({ groupId, err }, 'Failed to delete images for group'))
    }

    async deleteByProject(groupId: number, projectId: number): Promise<void> {
        const sub = join(String(groupId), String(projectId))
        await Promise.all([
            this.deleteDirectory(join(IMAGES_DIR, sub)),
            this.deleteDirectory(join(THUMBNAILS_DIR, sub)),
        ]).catch((err) =>
            this.log.error({ groupId, projectId, err }, 'Failed to delete images for project'),
        )
    }

    async deleteByScene(groupId: number, projectId: number, sceneId: number): Promise<void> {
        const sub = join(String(groupId), String(projectId), String(sceneId))
        await Promise.all([
            this.deleteDirectory(join(IMAGES_DIR, sub)),
            this.deleteDirectory(join(THUMBNAILS_DIR, sub)),
        ]).catch((err) =>
            this.log.error(
                { groupId, projectId, sceneId, err },
                'Failed to delete images for scene',
            ),
        )
    }

    async deleteByImage(
        groupId: number,
        projectId: number,
        sceneId: number,
        imageId: number,
    ): Promise<void> {
        const sub = join(String(groupId), String(projectId), String(sceneId))
        await Promise.all([
            fs.rm(join(IMAGES_DIR, sub, `${imageId}.png`), { force: true }),
            fs.rm(join(THUMBNAILS_DIR, sub, `${imageId}.webp`), { force: true }),
        ]).catch((err) =>
            this.log.error({ groupId, projectId, sceneId, imageId, err }, 'Failed to delete image'),
        )
    }

    async generateThumbnail(sourcePath: string, thumbnailPath: string): Promise<void> {
        try {
            await sharp(sourcePath)
                .resize(512, 512, { fit: 'inside' })
                .webp({ quality: 80 })
                .toFile(thumbnailPath)
        } catch (err) {
            this.log.error({ sourcePath, err }, 'Thumbnail generation failed')
        }
    }

    private async deleteDirectory(path: string): Promise<void> {
        await fs.rm(path, { recursive: true, force: true })
    }
}

export const imageService = new ImageService()
