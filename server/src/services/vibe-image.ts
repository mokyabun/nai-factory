import { eq } from 'drizzle-orm'
import { db, vibeTransfers } from '@/db'
import logger from '@/logger'
import type { NovelAIModel, NovelAIVibeImage } from '@/types'
import { encodeVibe } from './novelai'

const log = logger.child({ module: 'vibe-image' })

export async function checkVibe(
    vibeTransferId: number,
    apiKey: string,
    model: NovelAIModel,
): Promise<{ encodedData: string; referenceStrength: number }> {
    const [vibe] = await db.select().from(vibeTransfers).where(eq(vibeTransfers.id, vibeTransferId))

    if (!vibe) throw new Error(`Vibe transfer ${vibeTransferId} not found`)

    const needsEncoding =
        !vibe.encodedData || vibe.encodedInformationExtracted !== vibe.informationExtracted

    if (!needsEncoding) {
        log.debug({ vibeTransferId }, 'Vibe cache hit')
        return {
            encodedData: vibe.encodedData!,
            referenceStrength: vibe.referenceStrength,
        }
    }

    log.info({ vibeTransferId, reason: !vibe.encodedData ? 'missing' : 'stale' }, 'Encoding vibe')

    const sourceFile = Bun.file(vibe.sourceImagePath)
    if (!(await sourceFile.exists())) {
        throw new Error(`Vibe source image not found: ${vibe.sourceImagePath}`)
    }
    const imageBase64 = Buffer.from(await sourceFile.arrayBuffer()).toString('base64')

    const encodedData = await encodeVibe(apiKey, {
        image: imageBase64,
        information_extracted: vibe.informationExtracted,
        model,
    })

    await db
        .update(vibeTransfers)
        .set({
            encodedData,
            encodedInformationExtracted: vibe.informationExtracted,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(vibeTransfers.id, vibeTransferId))

    log.info({ vibeTransferId }, 'Vibe encoded and cached')

    return {
        encodedData,
        referenceStrength: vibe.referenceStrength,
    }
}

export async function checkVibesForProject(
    projectId: number,
    apiKey: string,
    model: NovelAIModel,
): Promise<NovelAIVibeImage[]> {
    const vibes = await db
        .select()
        .from(vibeTransfers)
        .where(eq(vibeTransfers.projectId, projectId))

    if (vibes.length === 0) return []

    const results: NovelAIVibeImage[] = []

    for (const vibe of vibes) {
        const { encodedData, referenceStrength } = await checkVibe(vibe.id, apiKey, model)
        results.push({ encodedImage: encodedData, strength: referenceStrength })
    }

    return results
}

export async function invalidateVibe(vibeTransferId: number): Promise<void> {
    await db
        .update(vibeTransfers)
        .set({
            encodedData: null,
            encodedInformationExtracted: null,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(vibeTransfers.id, vibeTransferId))

    log.info({ vibeTransferId }, 'Vibe encoding invalidated')
}
