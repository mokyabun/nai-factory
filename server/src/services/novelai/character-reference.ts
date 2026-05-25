import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import type {
    CharacterReferenceUploadFile,
    NovelAICharacterReferenceImage,
} from '@nai-factory/types'
import { asc, desc, eq } from 'drizzle-orm'
import sharp from 'sharp'
import { CHARACTER_REFERENCES_DIR } from '#/config'
import { characterReferences, db } from '#/db'
import logger from '#/logger'
import { nextDisplayOrder, nowIso } from '#/shared'
import { createUniqueReferenceCacheKey, isReferenceCacheFresh } from './reference-cache'

const log = logger.child({ module: 'character-reference' })

const DIRECTOR_DIMENSIONS = [
    { width: 1472, height: 1472, aspect: 1 },
    { width: 1536, height: 1024, aspect: 1536 / 1024 },
    { width: 1024, height: 1536, aspect: 1024 / 1536 },
]
const DEFAULT_DIRECTOR_DIMENSION = DIRECTOR_DIMENSIONS[0] ?? {
    width: 1472,
    height: 1472,
    aspect: 1,
}

function normalizePath(path: string) {
    return path.replaceAll('\\', '/')
}

async function ensureDir(path: string) {
    await fs.mkdir(dirname(path), { recursive: true })
}

async function safeRemove(path: string | null) {
    if (!path) return

    try {
        await fs.rm(path, { force: true })
    } catch (error) {
        log.error({ path, err: error }, 'Failed to remove character reference file')
    }
}

export async function generateCharacterReferenceThumbnail(
    sourcePath: string,
    thumbnailPath: string,
) {
    await ensureDir(thumbnailPath)
    await sharp(sourcePath)
        .resize({
            width: 256,
            height: 256,
            fit: 'inside',
            withoutEnlargement: true,
        })
        .png()
        .toFile(thumbnailPath)
}

export async function processCharacterReferenceImage(sourcePath: string) {
    const processedPath = sourcePath.replace(/\.[^.]+$/, '_processed.png')
    const metadata = await sharp(sourcePath).metadata()
    const sourceWidth = metadata.width ?? 1024
    const sourceHeight = metadata.height ?? 1024
    const sourceAspect = sourceWidth / sourceHeight

    let best = DEFAULT_DIRECTOR_DIMENSION
    let bestDiff = Math.abs(sourceAspect - best.aspect)

    for (const dimension of DIRECTOR_DIMENSIONS) {
        const diff = Math.abs(sourceAspect - dimension.aspect)
        if (diff < bestDiff) {
            best = dimension
            bestDiff = diff
        }
    }

    await sharp(sourcePath)
        .resize(best.width, best.height, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0 },
        })
        .png()
        .toFile(processedPath)

    return normalizePath(processedPath)
}

export async function listCharacterReferences(projectId: number) {
    return db
        .select()
        .from(characterReferences)
        .where(eq(characterReferences.projectId, projectId))
        .orderBy(asc(characterReferences.displayOrder), asc(characterReferences.id))
}

export async function uploadCharacterReference(
    projectId: number,
    imageFile: CharacterReferenceUploadFile,
) {
    const ext = extname(imageFile.name) || '.png'
    const baseName = randomUUID()
    const sourceImagePath = join(CHARACTER_REFERENCES_DIR, String(projectId), `${baseName}${ext}`)
    const thumbnailPath = join(CHARACTER_REFERENCES_DIR, String(projectId), `${baseName}_thumb.png`)

    await ensureDir(sourceImagePath)
    await fs.writeFile(sourceImagePath, Buffer.from(await imageFile.arrayBuffer()))
    await generateCharacterReferenceThumbnail(sourceImagePath, thumbnailPath)

    const [last] = await db
        .select({ displayOrder: characterReferences.displayOrder })
        .from(characterReferences)
        .where(eq(characterReferences.projectId, projectId))
        .orderBy(desc(characterReferences.displayOrder))
        .limit(1)

    const [created] = await db
        .insert(characterReferences)
        .values({
            projectId,
            displayOrder: nextDisplayOrder(last?.displayOrder),
            sourceImagePath: normalizePath(sourceImagePath),
            thumbnailPath: normalizePath(thumbnailPath),
        })
        .returning()

    if (!created) throw new Error('Failed to create character reference')
    return created
}

export async function deleteCharacterReferenceFiles(
    ref: Pick<
        typeof characterReferences.$inferSelect,
        'sourceImagePath' | 'thumbnailPath' | 'processedImagePath'
    >,
) {
    await Promise.all([
        safeRemove(ref.sourceImagePath),
        safeRemove(ref.thumbnailPath),
        safeRemove(ref.processedImagePath),
    ])
}

export async function removeCharacterReferencesByProject(projectId: number) {
    await fs.rm(join(CHARACTER_REFERENCES_DIR, String(projectId)), {
        recursive: true,
        force: true,
    })
}

export async function prepareCharacterReferencesForProject(
    projectId: number,
    model: string,
): Promise<NovelAICharacterReferenceImage[]> {
    const refs = await db
        .select()
        .from(characterReferences)
        .where(eq(characterReferences.projectId, projectId))
        .orderBy(asc(characterReferences.displayOrder), asc(characterReferences.id))

    const enabledRefs = refs.filter((ref) => ref.enabled)
    if (enabledRefs.length === 0) return []

    if (!model.includes('4-5')) {
        throw new Error('Character Reference requires a V4.5 model')
    }

    const prepared: NovelAICharacterReferenceImage[] = []

    for (const [index, ref] of enabledRefs.entries()) {
        let processedImagePath = ref.processedImagePath
        const processedExists = processedImagePath
            ? await Bun.file(processedImagePath).exists()
            : false

        if (!processedImagePath || !processedExists) {
            processedImagePath = await processCharacterReferenceImage(ref.sourceImagePath)
            await db
                .update(characterReferences)
                .set({ processedImagePath, updatedAt: nowIso() })
                .where(eq(characterReferences.id, ref.id))
        }

        let cacheSecretKey = ref.cacheSecretKey
        let uploadFieldName: string | undefined
        let filePath: string | undefined

        if (!isReferenceCacheFresh(ref.cacheSecretKey, ref.cacheCreatedAt)) {
            cacheSecretKey = await createUniqueReferenceCacheKey()
            uploadFieldName = `director_ref_${index}`
            filePath = processedImagePath
            await db
                .update(characterReferences)
                .set({
                    cacheSecretKey,
                    cacheCreatedAt: null,
                    updatedAt: nowIso(),
                })
                .where(eq(characterReferences.id, ref.id))
        }

        if (!cacheSecretKey) throw new Error(`Character reference ${ref.id} has no cache key`)

        prepared.push({
            id: ref.id,
            cacheSecretKey,
            uploadFieldName,
            filePath,
            strength: ref.strength,
            fidelity: ref.fidelity,
            mode: ref.referenceMode,
        })
    }

    return prepared
}

export async function markCharacterReferenceCachesUploaded(ids: number[]) {
    if (ids.length === 0) return

    const cacheCreatedAt = nowIso()
    for (const id of ids) {
        await db
            .update(characterReferences)
            .set({ cacheCreatedAt, updatedAt: cacheCreatedAt })
            .where(eq(characterReferences.id, id))
    }
}
