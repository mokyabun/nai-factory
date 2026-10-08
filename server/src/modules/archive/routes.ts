import { contract } from '@nai-factory/shared'
import type { Hono } from 'hono'

import type { AppContext, AppEnv } from '@/context'
import { contentDisposition, route } from '@/lib/http'
import { createZipStream } from '@/lib/zip'

import { collectExportAssets, exportToServer, exportZipEntries, zipFilename } from './export'
import * as service from './service'

export function registerArchiveRoutes(app: Hono<AppEnv>, ctx: AppContext) {
    const api = contract.projects

    route(app, api.exportArchive, ({ params, body }) => {
        const archive = service.buildArchive(ctx, params.id, body)
        return new Response(createZipStream(service.archiveEntries(ctx, archive)), {
            headers: {
                'Content-Type': 'application/vnd.nai-factory.project+zip',
                'Content-Disposition': contentDisposition(archive.filename),
            },
        })
    })
    route(app, api.importArchive, ({ body }) => service.importArchive(ctx, body.archive))

    route(app, api.exportFiles, ({ params, body }) => {
        const { assets } = collectExportAssets(ctx, params.id, body)
        return { exported: assets.length, assets }
    })
    route(app, api.exportZip, ({ params, body }) => {
        const { project, assets } = collectExportAssets(ctx, params.id, body)
        return new Response(createZipStream(exportZipEntries(ctx, assets)), {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': contentDisposition(zipFilename(project.name)),
            },
        })
    })
    route(app, api.exportServer, ({ params, body }) => exportToServer(ctx, params.id, body))
}
