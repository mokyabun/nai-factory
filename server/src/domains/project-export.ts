import { zValidator } from '@hono/zod-validator'
import { ProjectArchiveExportBody, ProjectExportBody, ProjectIdParams } from '@nai-factory/shared'
import { Hono } from 'hono'
import { createProjectArchive } from '@/services/app/project-archive'
import {
    collectExportAssets,
    createExportZip,
    exportToServerPath,
} from '@/services/app/project-export'

function contentDisposition(filename: string) {
    const fallback = filename
        .split('')
        .map((char) => {
            const code = char.charCodeAt(0)
            return code >= 32 && code < 127 && char !== '"' && char !== '\\' ? char : '_'
        })
        .join('')

    return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

export const projectExport = new Hono()
    .post(
        '/archive',
        zValidator('param', ProjectIdParams),
        zValidator('json', ProjectArchiveExportBody),
        async (c) => {
            const result = await createProjectArchive(
                c.req.valid('param').projectId,
                c.req.valid('json'),
            )

            return new Response(result.archive, {
                headers: {
                    'content-type': 'application/vnd.nai-factory.project+zip',
                    'content-disposition': contentDisposition(result.filename),
                },
            })
        },
    )
    .post(
        '/export/files',
        zValidator('param', ProjectIdParams),
        zValidator('json', ProjectExportBody),
        async (c) => {
            const { assets } = await collectExportAssets(
                c.req.valid('param').projectId,
                c.req.valid('json'),
            )
            return c.json({ exported: assets.length, assets })
        },
    )
    .post(
        '/export/zip',
        zValidator('param', ProjectIdParams),
        zValidator('json', ProjectExportBody),
        async (c) => {
            const result = await createExportZip(
                c.req.valid('param').projectId,
                c.req.valid('json'),
            )

            return new Response(result.zip, {
                headers: {
                    'content-type': 'application/zip',
                    'content-disposition': contentDisposition(result.filename),
                },
            })
        },
    )
    .post(
        '/export/server',
        zValidator('param', ProjectIdParams),
        zValidator('json', ProjectExportBody),
        async (c) => {
            return c.json(
                await exportToServerPath(c.req.valid('param').projectId, c.req.valid('json')),
            )
        },
    )
