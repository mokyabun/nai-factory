import fs from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { asc, desc, eq } from 'drizzle-orm'
import { status } from 'elysia'
import { VIBES_DIR } from '../../config'
import { db, projects, vibeTransfers } from '../../db'
import { invalidateVibe } from '../../services'
import { displayOrderBetween, nextDisplayOrder, requireEntity, withUpdatedAt } from '../../shared'

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
    if (sibling.projectId !== projectId)
        throw status(400, `${label} vibe transfer belongs to another project`)

    return sibling.displayOrder
}

export async function list(projectId: number) {
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

export async function upload(projectId: number, imageFile: File) {
    await getProject(projectId)

    const ext = extname(imageFile.name) || '.png'
    const filename = `${Date.now()}${ext}`
    const filePath = join(VIBES_DIR, String(projectId), filename)

    await fs.mkdir(dirname(filePath), { recursive: true })

    const buffer = await imageFile.arrayBuffer()
    await fs.writeFile(filePath, Buffer.from(buffer))

    const [last] = await db
        .select({ displayOrder: vibeTransfers.displayOrder })
        .from(vibeTransfers)
        .where(eq(vibeTransfers.projectId, projectId))
        .orderBy(desc(vibeTransfers.displayOrder))
        .limit(1)

    const displayOrder = nextDisplayOrder(last?.displayOrder)

    const [created] = await db
        .insert(vibeTransfers)
        .values({
            projectId,
            displayOrder,
            sourceImagePath: filePath.replaceAll('\\', '/'),
            referenceStrength: 0.6,
            informationExtracted: 1.0,
        })
        .returning()

    if (!created) throw new Error('Failed to create vibe transfer')
    return created
}

export async function update(
    id: number,
    body: { referenceStrength?: number; informationExtracted?: number },
) {
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

    return updated ?? null
}

export async function reorder(id: number, prevId: number | null, nextId: number | null) {
    const [existing] = await db
        .select({ projectId: vibeTransfers.projectId })
        .from(vibeTransfers)
        .where(eq(vibeTransfers.id, id))
    if (!existing) return null

    const prevOrder = prevId ? await getSiblingOrder(prevId, existing.projectId, 'Previous') : null
    const nextOrder = nextId ? await getSiblingOrder(nextId, existing.projectId, 'Next') : null
    const displayOrder = displayOrderBetween(prevOrder, nextOrder)

    const [updated] = await db
        .update(vibeTransfers)
        .set(withUpdatedAt({ displayOrder }))
        .where(eq(vibeTransfers.id, id))
        .returning()

    return updated ?? null
}

export async function remove(id: number) {
    const [existing] = await db.select().from(vibeTransfers).where(eq(vibeTransfers.id, id))
    if (!existing) return false

    await db.delete(vibeTransfers).where(eq(vibeTransfers.id, id))

    try {
        await fs.rm(existing.sourceImagePath, { force: true })
    } catch {
        // ignore file not found
    }

    return true
}
