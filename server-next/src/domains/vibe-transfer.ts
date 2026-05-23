import fs from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { zValidator } from '@hono/zod-validator'
import {
<<<<<<< HEAD
    type ImageUpload,
    ProjectIdParams,
    VibeTransferItemParams,
    VibeTransferOrderPatchBody,
    VibeTransferPatchBody,
    VibeTransferUploadBody,
} from '@nai-factory/types'
import { asc, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { VIBES_DIR } from '#/config'
import { db, projects, vibeTransfers } from '#/db'
import { invalidateVibe } from '#/services'
import {
    displayOrderBetween,
    httpError,
    nextDisplayOrder,
    requireEntity,
    withUpdatedAt,
} from '#/shared'
=======
    type ImageUploadFile,
    ProjectIdParams,
    ReorderVibeTransferBody,
    UpdateVibeTransferBody,
    UploadVibeTransferBody,
    VibeTransferParams,
} from '@nai-factory/types'
import { asc, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { VIBES_DIR } from '#/config'
import { db, projects, vibeTransfers } from '#/db'
import { invalidateVibe } from '#/services'
import { displayOrderBetween, nextDisplayOrder, requireEntity, withUpdatedAt } from '#/shared'
>>>>>>> refs/remotes/origin/main

async function getProject(projectId: number) {
    const [project] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, projectId))
    return requireEntity(project, 'Project not found')
}

async function getSiblingOrder(id: number, projectId: number, label: string) {
    const [vibe] = await db
        .select({ projectId: vibeTransfers.projectId, displayOrder: vibeTransfers.displayOrder })
        .from(vibeTransfers)
        .where(eq(vibeTransfers.id, id))

    const sibling = requireEntity(vibe, `${label} vibe transfer not found`)
<<<<<<< HEAD
    if (sibling.projectId !== projectId)
        throw httpError(400, `${label} vibe transfer belongs to another project`)
=======
    if (sibling.projectId !== projectId) {
        throw new HTTPException(400, {
            message: `${label} vibe transfer belongs to another project`,
        })
    }
>>>>>>> refs/remotes/origin/main

    return sibling.displayOrder
}

async function list(projectId: number) {
    return db
        .select({
            id: vibeTransfers.id,
            projectId: vibeTransfers.projectId,
            displayOrder: vibeTransfers.displayOrder,
            sourceImagePath: vibeTransfers.sourceImagePath,
            referenceStrength: vibeTransfers.referenceStrength,
            informationExtracted: vibeTransfers.informationExtracted,
            createdAt: vibeTransfers.createdAt,
            updatedAt: vibeTransfers.updatedAt,
        })
        .from(vibeTransfers)
        .where(eq(vibeTransfers.projectId, projectId))
        .orderBy(asc(vibeTransfers.displayOrder), asc(vibeTransfers.id))
}

<<<<<<< HEAD
async function upload(projectId: number, imageFile: ImageUpload) {
    await getProject(projectId)

    const ext = extname(imageFile.name) || '.png'
    const filePath = join(VIBES_DIR, String(projectId), `${Date.now()}${ext}`)
=======
async function upload(projectId: number, imageFile: ImageUploadFile) {
    await getProject(projectId)

    const ext = extname(imageFile.name) || '.png'
    const filename = `${Date.now()}${ext}`
    const filePath = join(VIBES_DIR, String(projectId), filename)
>>>>>>> refs/remotes/origin/main
    await fs.mkdir(dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, Buffer.from(await imageFile.arrayBuffer()))

    const [last] = await db
        .select({ displayOrder: vibeTransfers.displayOrder })
        .from(vibeTransfers)
        .where(eq(vibeTransfers.projectId, projectId))
        .orderBy(desc(vibeTransfers.displayOrder))
        .limit(1)

    const [created] = await db
        .insert(vibeTransfers)
        .values({
            projectId,
            displayOrder: nextDisplayOrder(last?.displayOrder),
            sourceImagePath: filePath.replaceAll('\\', '/'),
            referenceStrength: 0.6,
<<<<<<< HEAD
            informationExtracted: 1,
        })
        .returning()
    if (!created) throw httpError(500, 'Failed to create vibe transfer')

    return created
}

async function update(id: number, body: VibeTransferPatchBody) {
=======
            informationExtracted: 1.0,
        })
        .returning()

    if (!created) throw new HTTPException(500, { message: 'Failed to create vibe transfer' })
    return created
}

async function update(id: number, body: UpdateVibeTransferBody) {
>>>>>>> refs/remotes/origin/main
    const [existing] = await db.select().from(vibeTransfers).where(eq(vibeTransfers.id, id))
    if (!existing) return null

    if (
        body.informationExtracted !== undefined &&
        body.informationExtracted !== existing.informationExtracted
    ) {
        await invalidateVibe(id)
    }

    const [updated] = await db
        .update(vibeTransfers)
        .set(withUpdatedAt(body))
        .where(eq(vibeTransfers.id, id))
        .returning()
<<<<<<< HEAD

=======
>>>>>>> refs/remotes/origin/main
    return updated ?? null
}

async function reorder(id: number, prevId: number | null, nextId: number | null) {
    const [existing] = await db
        .select({ projectId: vibeTransfers.projectId })
        .from(vibeTransfers)
        .where(eq(vibeTransfers.id, id))
    if (!existing) return null

    const prevOrder = prevId ? await getSiblingOrder(prevId, existing.projectId, 'Previous') : null
    const nextOrder = nextId ? await getSiblingOrder(nextId, existing.projectId, 'Next') : null
<<<<<<< HEAD
    const displayOrder = displayOrderBetween(prevOrder, nextOrder)
    const [updated] = await db
        .update(vibeTransfers)
        .set(withUpdatedAt({ displayOrder }))
=======
    const [updated] = await db
        .update(vibeTransfers)
        .set(withUpdatedAt({ displayOrder: displayOrderBetween(prevOrder, nextOrder) }))
>>>>>>> refs/remotes/origin/main
        .where(eq(vibeTransfers.id, id))
        .returning()

    return updated ?? null
}

async function remove(id: number) {
    const [existing] = await db.select().from(vibeTransfers).where(eq(vibeTransfers.id, id))
    if (!existing) return false

    await db.delete(vibeTransfers).where(eq(vibeTransfers.id, id))
    await fs.rm(existing.sourceImagePath, { force: true })
<<<<<<< HEAD

=======
>>>>>>> refs/remotes/origin/main
    return true
}

export const vibeTransfer = new Hono()
<<<<<<< HEAD
    .get('/:projectId/vibe-transfers', zValidator('param', ProjectIdParams), async (c) => {
        return c.json(await list(c.req.valid('param').projectId))
    })
    .post(
        '/:projectId/vibe-transfers/upload',
        zValidator('param', ProjectIdParams),
        zValidator('form', VibeTransferUploadBody),
        async (c) => {
            return c.json(
                await upload(c.req.valid('param').projectId, c.req.valid('form').image),
                201,
            )
        },
    )
    .patch(
        '/:projectId/vibe-transfers/reorder',
        zValidator('param', ProjectIdParams),
        zValidator('json', VibeTransferOrderPatchBody),
        async (c) => {
            const { id, prevId, nextId } = c.req.valid('json')
            const result = await reorder(id, prevId, nextId)
            if (!result) return c.text('Vibe transfer not found', 404)

            return c.json(result)
        },
    )
    .patch(
        '/:projectId/vibe-transfers/:id',
        zValidator('param', VibeTransferItemParams),
        zValidator('json', VibeTransferPatchBody),
        async (c) => {
            const result = await update(c.req.valid('param').id, c.req.valid('json'))
            if (!result) return c.text('Vibe transfer not found', 404)

            return c.json(result)
        },
    )
    .delete(
        '/:projectId/vibe-transfers/:id',
        zValidator('param', VibeTransferItemParams),
        async (c) => {
            if (!(await remove(c.req.valid('param').id)))
                return c.text('Vibe transfer not found', 404)

            return c.body(null, 204)
        },
    )
=======
    .get('/', zValidator('param', ProjectIdParams), async (c) =>
        c.json(await list(c.req.valid('param').projectId)),
    )
    .post(
        '/upload',
        zValidator('param', ProjectIdParams),
        zValidator('form', UploadVibeTransferBody),
        async (c) => {
            const { projectId } = c.req.valid('param')
            const { image } = c.req.valid('form')
            return c.json(await upload(projectId, image))
        },
    )
    .patch('/reorder', zValidator('json', ReorderVibeTransferBody), async (c) => {
        const { id, prevId, nextId } = c.req.valid('json')
        const result = await reorder(id, prevId, nextId)
        if (!result) throw new HTTPException(404, { message: 'Vibe transfer not found' })
        return c.json(result)
    })
    .patch(
        '/:id',
        zValidator('param', VibeTransferParams),
        zValidator('json', UpdateVibeTransferBody),
        async (c) => {
            const result = await update(c.req.valid('param').id, c.req.valid('json'))
            if (!result) throw new HTTPException(404, { message: 'Vibe transfer not found' })
            return c.json(result)
        },
    )
    .delete('/:id', zValidator('param', VibeTransferParams), async (c) => {
        const success = await remove(c.req.valid('param').id)
        if (!success) throw new HTTPException(404, { message: 'Vibe transfer not found' })
        return c.body(null, 204)
    })
>>>>>>> refs/remotes/origin/main
