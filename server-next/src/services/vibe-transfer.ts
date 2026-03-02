import fs from 'fs/promises'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { asc, desc, eq } from 'drizzle-orm'
import { generateKeyBetween } from 'fractional-indexing-jittered'
import { db, vibeTransfers } from '@/db'
import { invalidateVibe } from './vibe-image'

const VIBES_DIR = './data/vibes'

export async function listByProject(projectId: number) {
    return db
        .select({
            id: vibeTransfers.id,
            projectId: vibeTransfers.projectId,
            displayOrder: vibeTransfers.displayOrder,
            sourceImagePath: vibeTransfers.sourceImagePath,
            referenceStrength: vibeTransfers.referenceStrength,
            informationExtracted: vibeTransfers.informationExtracted,
            // Omit encodedData from list responses
            createdAt: vibeTransfers.createdAt,
            updatedAt: vibeTransfers.updatedAt,
        })
        .from(vibeTransfers)
        .where(eq(vibeTransfers.projectId, projectId))
        .orderBy(asc(vibeTransfers.displayOrder), asc(vibeTransfers.id))
}

export async function getById(id: number) {
    const [row] = await db.select().from(vibeTransfers).where(eq(vibeTransfers.id, id))
    return row ?? null
}

export async function upload(projectId: number, imageFile: File) {
    const ext = extname(imageFile.name) || '.png'
    const filename = `${Date.now()}${ext}`
    const filePath = join(VIBES_DIR, String(projectId), filename)

    mkdirSync(dirname(filePath), { recursive: true })

    const buffer = await imageFile.arrayBuffer()
    writeFileSync(filePath, Buffer.from(buffer))

    const [last] = await db
        .select({ displayOrder: vibeTransfers.displayOrder })
        .from(vibeTransfers)
        .where(eq(vibeTransfers.projectId, projectId))
        .orderBy(desc(vibeTransfers.displayOrder))
        .limit(1)

    const displayOrder = generateKeyBetween(last?.displayOrder ?? null, null)

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

    return created!
}

export async function update(
    id: number,
    data: { referenceStrength?: number; informationExtracted?: number },
) {
    const [existing] = await db.select().from(vibeTransfers).where(eq(vibeTransfers.id, id))
    if (!existing) return null

    // If informationExtracted changes, invalidate cached encoding
    if (
        data.informationExtracted !== undefined &&
        data.informationExtracted !== existing.informationExtracted
    ) {
        await invalidateVibe(id)
    }

    const [updated] = await db
        .update(vibeTransfers)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(vibeTransfers.id, id))
        .returning()

    return updated ?? null
}

export async function reorder(id: number, prevId: number | null, nextId: number | null) {
    let prevOrder: string | null = null
    let nextOrder: string | null = null

    if (prevId) {
        const [prev] = await db
            .select({ displayOrder: vibeTransfers.displayOrder })
            .from(vibeTransfers)
            .where(eq(vibeTransfers.id, prevId))
        prevOrder = prev?.displayOrder ?? null
    }

    if (nextId) {
        const [next] = await db
            .select({ displayOrder: vibeTransfers.displayOrder })
            .from(vibeTransfers)
            .where(eq(vibeTransfers.id, nextId))
        nextOrder = next?.displayOrder ?? null
    }

    const displayOrder = generateKeyBetween(prevOrder, nextOrder)

    const [updated] = await db
        .update(vibeTransfers)
        .set({ displayOrder, updatedAt: new Date().toISOString() })
        .where(eq(vibeTransfers.id, id))
        .returning()

    return updated ?? null
}

export async function remove(id: number) {
    const [existing] = await db.select().from(vibeTransfers).where(eq(vibeTransfers.id, id))
    if (!existing) return false

    await db.delete(vibeTransfers).where(eq(vibeTransfers.id, id))

    // Clean up source image file
    try {
        await fs.rm(existing.sourceImagePath, { force: true })
    } catch {
        // Ignore file not found
    }

    return true
}
