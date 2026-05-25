import fs from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { zValidator } from '@hono/zod-validator'
import {
    type ImageUploadFile,
    ProjectIdParams,
    VibeTransferItemParams,
    VibeTransferOrderPatchBody,
    VibeTransferPatchBody,
    VibeTransferUploadBody,
} from '@nai-factory/types'
import { asc, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { VIBES_DIR } from '#/config'
import { db, projects, vibeTransfers } from '#/db'
import { invalidateVibe } from '#/services'
import { displayOrderBetween, nextDisplayOrder, requireEntity, withUpdatedAt } from '#/shared'

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
    if (sibling.projectId !== projectId) {
        throw new HTTPException(400, {
            message: `${label} vibe transfer belongs to another project`,
        })
    }

    return sibling.displayOrder
}

async function list(projectId: number) {
    await getProject(projectId)

    return db
        .select()
        .from(vibeTransfers)
        .where(eq(vibeTransfers.projectId, projectId))
        .orderBy(asc(vibeTransfers.displayOrder), asc(vibeTransfers.id))
}

async function upload(projectId: number, imageFile: ImageUploadFile) {
    await getProject(projectId)

    const ext = extname(imageFile.name) || '.png'
    const filePath = join(VIBES_DIR, String(projectId), `${Date.now()}${ext}`)
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
            informationExtracted: 1,
        })
        .returning()

    if (!created) throw new HTTPException(500, { message: 'Failed to create vibe transfer' })
    return created
}

async function update(projectId: number, id: number, body: VibeTransferPatchBody) {
    const [existing] = await db.select().from(vibeTransfers).where(eq(vibeTransfers.id, id))
    if (!existing) return null
    if (existing.projectId !== projectId) return null

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

    return updated ?? null
}

async function reorder(
    projectId: number,
    id: number,
    prevId: number | null,
    nextId: number | null,
) {
    const [existing] = await db
        .select({ projectId: vibeTransfers.projectId })
        .from(vibeTransfers)
        .where(eq(vibeTransfers.id, id))
    if (!existing) return null
    if (existing.projectId !== projectId) return null

    const prevOrder = prevId ? await getSiblingOrder(prevId, existing.projectId, 'Previous') : null
    const nextOrder = nextId ? await getSiblingOrder(nextId, existing.projectId, 'Next') : null
    const [updated] = await db
        .update(vibeTransfers)
        .set(withUpdatedAt({ displayOrder: displayOrderBetween(prevOrder, nextOrder) }))
        .where(eq(vibeTransfers.id, id))
        .returning()

    return updated ?? null
}

async function remove(projectId: number, id: number) {
    const [existing] = await db.select().from(vibeTransfers).where(eq(vibeTransfers.id, id))
    if (!existing) return false
    if (existing.projectId !== projectId) return false

    await db.delete(vibeTransfers).where(eq(vibeTransfers.id, id))
    await fs.rm(existing.sourceImagePath, { force: true })

    return true
}

export const vibeTransfer = new Hono()
    .get('/', zValidator('param', ProjectIdParams), async (c) => {
        return c.json(await list(c.req.valid('param').projectId))
    })
    .post(
        '/upload',
        zValidator('param', ProjectIdParams),
        zValidator('form', VibeTransferUploadBody),
        async (c) => {
            const { projectId } = c.req.valid('param')
            const { image } = c.req.valid('form')
            return c.json(await upload(projectId, image), 201)
        },
    )
    .patch(
        '/reorder',
        zValidator('param', ProjectIdParams),
        zValidator('json', VibeTransferOrderPatchBody),
        async (c) => {
            const { projectId } = c.req.valid('param')
            const { id, prevId, nextId } = c.req.valid('json')
            const result = await reorder(projectId, id, prevId, nextId)
            if (!result) throw new HTTPException(404, { message: 'Vibe transfer not found' })

            return c.json(result)
        },
    )
    .patch(
        '/:id',
        zValidator('param', VibeTransferItemParams),
        zValidator('json', VibeTransferPatchBody),
        async (c) => {
            const { projectId, id } = c.req.valid('param')
            const result = await update(projectId, id, c.req.valid('json'))
            if (!result) throw new HTTPException(404, { message: 'Vibe transfer not found' })

            return c.json(result)
        },
    )
    .delete('/:id', zValidator('param', VibeTransferItemParams), async (c) => {
        const { projectId, id } = c.req.valid('param')
        if (!(await remove(projectId, id))) {
            throw new HTTPException(404, { message: 'Vibe transfer not found' })
        }

        return c.body(null, 204)
    })
