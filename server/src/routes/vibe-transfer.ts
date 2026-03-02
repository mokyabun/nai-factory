import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { eq } from 'drizzle-orm'
import { Elysia, status, t } from 'elysia'
import { db } from '@/db'
import { projects } from '@/db/schema'
import type { VibeTransfer } from '@/types'

const VIBES_DIR = './data/vibes'

const VibeTransferModel = {
    projectParams: t.Object({ projectId: t.Numeric() }),
    itemParams: t.Object({ projectId: t.Numeric(), index: t.Numeric() }),

    uploadBody: t.Object({
        image: t.File({ type: 'image' }),
    }),

    updateBody: t.Object({
        referenceStrength: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
        informationExtracted: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
    }),

    reorderBody: t.Object({
        fromIndex: t.Number(),
        toIndex: t.Number(),
    }),
}

async function getProject(projectId: number) {
    const [proj] = await db.select().from(projects).where(eq(projects.id, projectId))
    if (!proj) throw status(404, 'Project not found')
    return proj
}

async function get(projectId: number) {
    const proj = await getProject(projectId)
    return proj.vibeTransfers ?? []
}

async function upload(projectId: number, imageFile: File) {
    const proj = await getProject(projectId)

    const ext = extname(imageFile.name) || '.png'
    const filename = `${Date.now()}${ext}`
    const filePath = join(VIBES_DIR, String(projectId), filename)

    mkdirSync(dirname(filePath), { recursive: true })

    const buffer = await imageFile.arrayBuffer()
    writeFileSync(filePath, Buffer.from(buffer))

    const newVibe: VibeTransfer = {
        sourceImagePath: filePath.replaceAll('\\', '/'),
        referenceStrength: 0.6,
        informationExtracted: 1.0,
    }

    const updated = [...(proj.vibeTransfers ?? []), newVibe]

    const [result] = await db
        .update(projects)
        .set({
            vibeTransfers: JSON.stringify(updated) as unknown as typeof proj.vibeTransfers,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(projects.id, projectId))
        .returning()

    return result!.vibeTransfers
}

async function update(
    projectId: number,
    index: number,
    body: { referenceStrength?: number; informationExtracted?: number },
) {
    const proj = await getProject(projectId)
    const list = [...(proj.vibeTransfers ?? [])]

    if (index < 0 || index >= list.length) throw status(404, 'Vibe transfer not found')

    list[index] = { ...list[index]!, ...body } as VibeTransfer

    const [result] = await db
        .update(projects)
        .set({
            vibeTransfers: JSON.stringify(list) as unknown as typeof proj.vibeTransfers,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(projects.id, projectId))
        .returning()

    return result!.vibeTransfers
}

async function reorder(projectId: number, fromIndex: number, toIndex: number) {
    const proj = await getProject(projectId)
    const list = [...(proj.vibeTransfers ?? [])]

    if (fromIndex < 0 || fromIndex >= list.length) throw status(404, 'Vibe transfer not found')
    if (toIndex < 0 || toIndex >= list.length) throw status(400, 'Invalid target index')

    const item = list.splice(fromIndex, 1)[0]!
    list.splice(toIndex, 0, item)

    const [result] = await db
        .update(projects)
        .set({
            vibeTransfers: JSON.stringify(list) as unknown as typeof proj.vibeTransfers,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(projects.id, projectId))
        .returning()

    return result!.vibeTransfers
}

async function remove(projectId: number, index: number) {
    const proj = await getProject(projectId)
    const list = [...(proj.vibeTransfers ?? [])]

    if (index < 0 || index >= list.length) throw status(404, 'Vibe transfer not found')

    list.splice(index, 1)

    const [result] = await db
        .update(projects)
        .set({
            vibeTransfers: JSON.stringify(list) as unknown as typeof proj.vibeTransfers,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(projects.id, projectId))
        .returning()

    return result!.vibeTransfers
}

export const vibeTransfer = new Elysia({ prefix: '/projects/:projectId/vibe-transfers' })
    .get('/', ({ params }) => get(params.projectId), {
        params: VibeTransferModel.projectParams,
    })
    .post('/upload', ({ params, body }) => upload(params.projectId, body.image), {
        params: VibeTransferModel.projectParams,
        body: VibeTransferModel.uploadBody,
    })
    .patch(
        '/reorder',
        ({ params, body }) => reorder(params.projectId, body.fromIndex, body.toIndex),
        {
            params: VibeTransferModel.projectParams,
            body: VibeTransferModel.reorderBody,
        },
    )
    .patch('/:index', ({ params, body }) => update(params.projectId, params.index, body), {
        params: VibeTransferModel.itemParams,
        body: VibeTransferModel.updateBody,
    })
    .delete('/:index', ({ params }) => remove(params.projectId, params.index), {
        params: VibeTransferModel.itemParams,
    })
