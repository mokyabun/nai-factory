import type { GlobalSettings, Prompt, SimpleNovelAIParameters } from '@nai-factory/shared'
import { desc, eq } from 'drizzle-orm'
import {
    db,
    images,
    playgroundImages,
    playgroundQueueItems,
    projects,
    queueItems,
    scenes,
    sceneVariations,
} from '@/db'
import logger from '@/logger'
import * as characterReferenceService from '@/services/novelai/character-reference'
import * as novelAIService from '@/services/novelai/novelai'
import * as vibeImageService from '@/services/novelai/vibe-image'
import { nextDisplayOrder } from '@/services/order'
import { withNormalizedVariables } from '@/utils'
import { realtimeEvents } from './events'
import * as imageService from './image'
import { compilePrompts, compileVariables } from './prompt'
import * as settingsService from './settings'

const log = logger.child({ module: 'queue-runner' })

function randomSeed() {
    return Math.floor(Math.random() * 1_000_000_000)
}

function generationParametersMetadata(params: SimpleNovelAIParameters) {
    return {
        model: params.model,
        width: params.width,
        height: params.height,
        steps: params.steps,
        promptGuidance: params.promptGuidance,
        promptGuidanceRescale: params.promptGuidanceRescale,
        sampler: params.sampler,
        noiseSchedule: params.noiseSchedule,
        seed: params.seed,
        qualityToggle: params.qualityToggle,
        varietyPlus: params.varietyPlus,
        normalizeReferenceStrengthValues: params.normalizeReferenceStrengthValues,
        useCharacterPositions: params.useCharacterPositions,
    }
}

function generationReferenceMetadata(params: SimpleNovelAIParameters) {
    return {
        vibeTransfers: params.vibeTransfers.map((ref) => ({
            strength: ref.strength,
        })),
        characterReferences: params.characterReferences.map((ref) => ({
            strength: ref.strength,
            fidelity: ref.fidelity,
            mode: ref.mode,
        })),
    }
}

function createGenerationMetadata(
    params: SimpleNovelAIParameters,
    context: Record<string, unknown> = {},
) {
    return {
        generator: 'nai-factory',
        ...context,
        generatedAt: new Date().toISOString(),
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        characterPrompts: params.characterPrompts,
        parameters: generationParametersMetadata(params),
        ...generationReferenceMetadata(params),
    }
}

async function generateImageData(
    params: SimpleNovelAIParameters,
    globalSettings: Readonly<GlobalSettings>,
    context: Record<string, unknown>,
) {
    const { imageData } = await novelAIService.generateImage(
        globalSettings.novelai.apiKey,
        params,
        {
            settings: globalSettings.debug,
            mode: globalSettings.novelai.mode,
            context,
        },
    )

    return imageData
}

async function loadJobContext(jobId: number) {
    const [job] = await db.select().from(queueItems).where(eq(queueItems.id, jobId)).limit(1)
    if (!job) throw new Error(`Job ${jobId} not found`)

    const globalSettings = settingsService.get()
    if (globalSettings.novelai.mode === 'live' && !globalSettings.novelai.apiKey)
        throw new Error('NovelAI API key not set in global settings')

    const [project, scene, variation] = await Promise.all([
        db
            .select()
            .from(projects)
            .where(eq(projects.id, job.projectId))
            .limit(1)
            .then((r) => r[0]),
        db
            .select()
            .from(scenes)
            .where(eq(scenes.id, job.sceneId))
            .limit(1)
            .then((r) => r[0]),
        db
            .select()
            .from(sceneVariations)
            .where(eq(sceneVariations.id, job.sceneVariationId))
            .limit(1)
            .then((r) => r[0]),
    ])

    if (!project) throw new Error(`Project ${job.projectId} not found`)
    if (!scene) throw new Error(`Scene ${job.sceneId} not found`)
    if (!variation) throw new Error(`Scene variation ${job.sceneVariationId} not found`)

    return {
        job,
        project: withNormalizedVariables(project),
        scene,
        variation: withNormalizedVariables(variation),
        globalSettings,
    }
}

async function generateAndSaveImage(
    job: typeof queueItems.$inferSelect,
    project: typeof projects.$inferSelect,
    scene: typeof scenes.$inferSelect,
    params: SimpleNovelAIParameters,
    globalSettings: Readonly<GlobalSettings>,
): Promise<void> {
    const imageData = await generateImageData(params, globalSettings, {
        jobId: job.id,
        projectId: project.id,
        projectName: project.name,
        sceneId: scene.id,
        sceneName: scene.name,
        sceneVariationId: job.sceneVariationId,
    })

    const metadata = createGenerationMetadata(params, {
        projectId: project.id,
        projectName: project.name,
        sceneId: scene.id,
        sceneName: scene.name,
        sceneVariationId: job.sceneVariationId,
    })

    const [lastImage] = await db
        .select({ displayOrder: images.displayOrder })
        .from(images)
        .where(eq(images.sceneId, scene.id))
        .orderBy(desc(images.displayOrder))
        .limit(1)

    const newDisplayOrder = nextDisplayOrder(lastImage?.displayOrder)
    const [image] = await db
        .insert(images)
        .values({
            sceneId: job.sceneId,
            displayOrder: newDisplayOrder,
            filePath: '',
            thumbnailPath: '',
            metadata,
        })
        .returning({ id: images.id })

    if (!image) throw new Error('Failed to create image record')

    try {
        const { filePath, thumbnailPath } = await imageService.save(
            project.id,
            scene.id,
            image.id,
            imageData,
            globalSettings.image,
            metadata,
        )

        await db.update(images).set({ filePath, thumbnailPath }).where(eq(images.id, image.id))

        log.debug({ imageId: image.id, filePath }, 'Image saved')
    } catch (error) {
        // Clean up the orphaned DB record on file-save failure
        await db
            .delete(images)
            .where(eq(images.id, image.id))
            .catch(() => {})

        throw error
    }
}

async function generateAndSavePlaygroundImage(
    job: typeof playgroundQueueItems.$inferSelect,
    params: SimpleNovelAIParameters,
    globalSettings: Readonly<GlobalSettings>,
): Promise<void> {
    const imageData = await generateImageData(params, globalSettings, {
        jobId: job.id,
        source: 'playground',
    })

    const metadata = createGenerationMetadata(params, { source: 'playground' })

    const [image] = await db
        .insert(playgroundImages)
        .values({
            prompt: job.prompt,
            negativePrompt: job.negativePrompt,
            parameters: job.parameters,
            filePath: '',
            thumbnailPath: '',
            metadata,
        })
        .returning({ id: playgroundImages.id })

    if (!image) throw new Error('Failed to create playground image record')

    try {
        const { filePath, thumbnailPath } = await imageService.savePlayground(
            image.id,
            imageData,
            globalSettings.image,
            metadata,
        )

        await db
            .update(playgroundImages)
            .set({ filePath, thumbnailPath })
            .where(eq(playgroundImages.id, image.id))

        log.debug({ imageId: image.id, filePath }, 'Playground image saved')
    } catch (error) {
        await db
            .delete(playgroundImages)
            .where(eq(playgroundImages.id, image.id))
            .catch(() => {})

        throw error
    }
}

async function markUploadedReferenceCaches(params: SimpleNovelAIParameters) {
    const uploadedVibeIds = params.vibeTransfers
        .map((ref) => (ref.uploadFieldName && ref.filePath ? ref.id : undefined))
        .filter((id): id is number => id !== undefined)
    const uploadedCharacterReferenceIds = params.characterReferences
        .map((ref) => (ref.uploadFieldName && ref.filePath ? ref.id : undefined))
        .filter((id): id is number => id !== undefined)

    await Promise.all([
        vibeImageService.markVibeCachesUploaded(uploadedVibeIds),
        characterReferenceService.markCharacterReferenceCachesUploaded(
            uploadedCharacterReferenceIds,
        ),
    ])

    for (const ref of [...params.vibeTransfers, ...params.characterReferences]) {
        delete ref.uploadFieldName
        delete ref.filePath
    }
}

export async function* runJob(jobId: number) {
    const { job, project, scene, variation, globalSettings } = await loadJobContext(jobId)
    const startedAt = Date.now()
    log.debug(
        {
            jobId,
            sceneId: job.sceneId,
            sceneVariationId: job.sceneVariationId,
            projectId: job.projectId,
        },
        'Processing job',
    )

    const [vibeTransfers, characterReferences] = await Promise.all([
        vibeImageService.checkVibesForProject(
            project.id,
            globalSettings.novelai.apiKey,
            project.parameters.model,
        ),
        characterReferenceService.prepareCharacterReferencesForProject(
            project.id,
            project.parameters.model,
        ),
    ])
    log.debug(
        {
            jobId,
            vibeTransferCount: vibeTransfers.length,
            characterReferenceCount: characterReferences.length,
        },
        'References prepared for generation',
    )

    const sourcePrompt: Prompt = {
        prompt: project.prompt,
        negativePrompt: project.negativePrompt,
        characterPrompts: project.characterPrompts,
    }

    const compiledVars = compileVariables(globalSettings.globalVariables, project.variables, [
        variation.variables,
    ])
    const compiledPrompts = compilePrompts(sourcePrompt, compiledVars)
    log.debug({ jobId, promptCount: compiledPrompts.length }, 'Prompts compiled')

    for (const [index, prompt] of compiledPrompts.entries()) {
        const params: SimpleNovelAIParameters = {
            ...project.parameters,

            prompt: prompt.prompt,
            negativePrompt: prompt.negativePrompt,
            characterPrompts: prompt.characterPrompts,

            vibeTransfers,
            characterReferences,
            seed: project.parameters.seed ?? randomSeed(),
        }

        log.debug(
            {
                jobId,
                promptIndex: index,
                promptCount: compiledPrompts.length,
                seed: params.seed,
            },
            'Generating image',
        )

        const variationStart = Date.now()
        await generateAndSaveImage(job, project, scene, params, globalSettings)
        await markUploadedReferenceCaches(params)
        const variationDuration = Date.now() - variationStart
        log.debug(
            {
                jobId,
                promptIndex: index,
                promptCount: compiledPrompts.length,
                durationMs: variationDuration,
            },
            'Image generation completed',
        )

        yield variationDuration
    }

    await db.delete(queueItems).where(eq(queueItems.id, jobId))
    realtimeEvents.publish({
        type: 'scene.images.changed',
        projectId: project.id,
        sceneId: scene.id,
    })
    log.debug({ jobId, durationMs: Date.now() - startedAt }, 'Job runner completed')
}

export async function* runPlaygroundJob(jobId: number) {
    const [job] = await db
        .select()
        .from(playgroundQueueItems)
        .where(eq(playgroundQueueItems.id, jobId))
        .limit(1)
    if (!job) throw new Error(`Playground job ${jobId} not found`)

    const globalSettings = settingsService.get()
    if (globalSettings.novelai.mode === 'live' && !globalSettings.novelai.apiKey) {
        throw new Error('NovelAI API key not set in global settings')
    }

    const startedAt = Date.now()
    log.debug({ jobId, source: 'playground' }, 'Processing playground job')

    const params: SimpleNovelAIParameters = {
        ...job.parameters,
        prompt: job.prompt,
        negativePrompt: job.negativePrompt,
        characterPrompts: [],
        vibeTransfers: [],
        characterReferences: [],
        seed: job.parameters.seed || randomSeed(),
    }

    const variationStart = Date.now()
    log.debug({ jobId, seed: params.seed }, 'Generating playground image')
    await generateAndSavePlaygroundImage(job, params, globalSettings)
    const durationMs = Date.now() - variationStart
    log.debug({ jobId, durationMs }, 'Playground image generation completed')
    yield durationMs

    await db.delete(playgroundQueueItems).where(eq(playgroundQueueItems.id, jobId))
    realtimeEvents.publish({ type: 'playground.images.changed' })
    log.debug({ jobId, durationMs: Date.now() - startedAt }, 'Playground job runner completed')
}
