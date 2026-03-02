import fs from 'fs/promises'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import logger from '../logger'

export const IMAGES_DIR = './data/images'
export const THUMBNAILS_DIR = './data/thumbnails'

class ImageService {
    private readonly logger = logger.child({ module: 'image' })

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

        this.logger.info({ filePath, sizeBytes: imageData.byteLength }, 'Image saved')

        await this.generateThumbnail(filePath, thumbnailPath)

        return {
            filePath: filePath.replaceAll('\\', '/'),
            thumbnailPath: thumbnailPath.replaceAll('\\', '/'),
        }
    }

    async deleteByGroup(groupId: number): Promise<void> {
        const groupPath = join(IMAGES_DIR, String(groupId))
        const thumbnailGroupPath = join(THUMBNAILS_DIR, String(groupId))

        try {
            await Promise.all([
                this.deleteDirectory(groupPath),
                this.deleteDirectory(thumbnailGroupPath),
            ])

            this.logger.info({ groupId }, 'Deleted images for group')
        } catch (error) {
            this.logger.error({ groupId, err: error }, 'Failed to delete images for group')
        }
    }

    async deleteByProject(groupId: number, projectId: number): Promise<void> {
        const projectPath = join(IMAGES_DIR, String(groupId), String(projectId))
        const thumbnailProjectPath = join(THUMBNAILS_DIR, String(groupId), String(projectId))

        try {
            await Promise.all([
                this.deleteDirectory(projectPath),
                this.deleteDirectory(thumbnailProjectPath),
            ])

            this.logger.info({ groupId, projectId }, 'Deleted images for project')
        } catch (error) {
            this.logger.error(
                { groupId, projectId, err: error },
                'Failed to delete images for project',
            )
        }
    }

    async deleteByScene(groupId: number, projectId: number, sceneId: number): Promise<void> {
        const scenePath = join(IMAGES_DIR, String(groupId), String(projectId), String(sceneId))
        const thumbnailScenePath = join(
            THUMBNAILS_DIR,
            String(groupId),
            String(projectId),
            String(sceneId),
        )

        try {
            await Promise.all([
                this.deleteDirectory(scenePath),
                this.deleteDirectory(thumbnailScenePath),
            ])

            this.logger.info({ groupId, projectId, sceneId }, 'Deleted images for scene')
        } catch (error) {
            this.logger.error(
                { groupId, projectId, sceneId, err: error },
                'Failed to delete images for scene',
            )
        }
    }

    async deleteByImage(groupId: number, projectId: number, sceneId: number, imageId: number) {
        const imagePath = join(
            IMAGES_DIR,
            String(groupId),
            String(projectId),
            String(sceneId),
            `${imageId}.png`,
        )
        const thumbnailImagePath = join(
            THUMBNAILS_DIR,
            String(groupId),
            String(projectId),
            String(sceneId),
            `${imageId}.webp`,
        )

        try {
            await Promise.all([
                fs.rm(imagePath, { force: true }),
                fs.rm(thumbnailImagePath, { force: true }),
            ])

            this.logger.info({ groupId, projectId, sceneId, imageId }, 'Deleted image')
        } catch (error) {
            this.logger.error(
                { groupId, projectId, sceneId, imageId, err: error },
                'Failed to delete image',
            )
        }
    }

    async generateThumbnail(sourcePath: string, thumbnailPath: string): Promise<void> {
        try {
            await sharp(sourcePath)
                .resize(512, 512, { fit: 'inside' })
                .webp({ quality: 80 })
                .toFile(thumbnailPath)

            this.logger.info({ thumbnailPath }, 'Thumbnail generated')
        } catch (error) {
            this.logger.error({ sourcePath, err: error }, 'Thumbnail generation failed')
        }
    }

    private async deleteDirectory(path: string): Promise<void> {
        try {
            await fs.rm(path, { recursive: true })

            this.logger.info({ path }, 'Deleted directory')
        } catch (error) {
            this.logger.error({ path, err: error }, 'Failed to delete directory')
        }
    }
}

export const imageService = new ImageService()
