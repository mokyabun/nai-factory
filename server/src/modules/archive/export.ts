import fs from 'node:fs/promises'
import { join } from 'node:path'

import type { ProjectExportAsset, ProjectExportBody } from '@nai-factory/shared'

import type { AppContext } from '@/context'
import { AppError, badRequest } from '@/lib/http'
import { resolveInside } from '@/lib/paths'
import type { ZipEntry } from '@/lib/zip'
import * as assets from '@/modules/assets/service'
import * as images from '@/modules/images/service'
import * as projects from '@/modules/projects/service'
import * as scenes from '@/modules/scenes/service'

import { renderOutputTemplate, sanitizeFilename, uniqueFilename } from './filenames'

function extensionOf(relPath: string) {
    const dot = relPath.lastIndexOf('.')
    return dot === -1 ? 'png' : relPath.slice(dot + 1)
}

/** The first `imageCount` images of every scene with their rendered filenames. */
export function collectExportAssets(ctx: AppContext, projectId: number, body: ProjectExportBody) {
    const project = projects.get(ctx, projectId)
    const template = body.outputTemplate ?? project.settings.outputTemplate
    const used = new Set<string>()
    const result: ProjectExportAsset[] = []

    for (const scene of scenes.sceneRows(ctx.db, projectId)) {
        for (const [index, image] of images
            .rowsByScene(ctx.db, scene.id)
            .slice(0, body.imageCount)
            .entries()) {
            const asset = assets.get(ctx, image.assetId)
            if (!asset) continue
            const filename = uniqueFilename(
                renderOutputTemplate(template, {
                    character: project.name,
                    scene: scene.name,
                    number: index + 1,
                    extension: extensionOf(asset.relPath),
                }),
                used,
            )
            result.push({
                imageId: image.id,
                assetId: asset.id,
                sceneId: scene.id,
                sceneName: scene.name,
                filename,
            })
        }
    }

    return { project, assets: result }
}

export async function* exportZipEntries(
    ctx: AppContext,
    items: ProjectExportAsset[],
): AsyncGenerator<ZipEntry> {
    for (const item of items) {
        const { data } = await assets.read(ctx, item.assetId)
        yield { name: item.filename, data, compress: false }
    }
}

export function zipFilename(projectName: string) {
    return `${sanitizeFilename(projectName)}-export.zip`
}

export async function exportToServer(
    ctx: AppContext,
    projectId: number,
    body: ProjectExportBody & { folder: string },
) {
    const exportDir = ctx.config.exportDir
    if (!exportDir) throw badRequest('Server export is not enabled (set NAI_FACTORY_EXPORT_DIR)')

    let target: string
    try {
        target = resolveInside(exportDir, body.folder)
    } catch {
        throw badRequest('Invalid export folder name')
    }

    const { assets: items } = collectExportAssets(ctx, projectId, body)
    await fs.mkdir(target, { recursive: true })

    const used = new Set((await fs.readdir(target)).map((name) => name.toLowerCase()))
    const written: ProjectExportAsset[] = []
    for (const item of items) {
        const filename = uniqueFilename(item.filename, used)
        const { data } = await assets.read(ctx, item.assetId)
        try {
            await fs.writeFile(join(target, filename), data, { flag: 'wx' })
        } catch (error) {
            throw new AppError(500, 'internal', `Failed to write ${filename}`, String(error))
        }
        written.push({ ...item, filename })
    }

    ctx.log.info(
        {
            event: 'project.export.server',
            projectId,
            exported: written.length,
            folder: body.folder,
        },
        'Project images exported to the server',
    )
    return { exported: written.length, assets: written }
}
