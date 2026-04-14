import { desc, eq } from 'drizzle-orm'
import { generateKeyBetween } from 'fractional-indexing-jittered'
import { db, images, projects, queueItems, scenes } from '@/db'
import logger from '@/logger'
import type { ImageSettings, Prompt, SimpleNovelAIParameters } from '@/types'
import { domainEvents } from './events'
import * as imageService from './image'
import * as novelAIService from './novelai'
import { compilePrompts, compileVariables } from './prompt'
import * as settingsService from './settings'
import * as vibeImageService from './vibe-image'

const log = logger.child({ module: 'queue-runner' })

async function loadJobContext(jobId: number) {
    const [job] = await db.select().from(queueItems).where(eq(queueItems.id, jobId)).limit(1)
    if (!job) throw new Error(`Job ${jobId} not found`)

    const globalSettings = settingsService.get()
    if (!globalSettings.novelai.apiKey)
        throw new Error('NovelAI API key not set in global settings')

    const [project, scene] = await Promise.all([
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
    ])

    if (!project) throw new Error(`Project ${job.projectId} not found`)
    if (!scene) throw new Error(`Scene ${job.sceneId} not found`)

    return { job, project, scene, globalSettings }
}

async function generateAndSaveImage(
    job: typeof queueItems.$inferSelect,
    project: typeof projects.$inferSelect,
    scene: typeof scenes.$inferSelect,
    params: SimpleNovelAIParameters,
    apiKey: string,
    imageSettings: ImageSettings,
): Promise<void> {
    const { imageData } = await novelAIService.generateImage(apiKey, params)

    const [lastImage] = await db
        .select({ displayOrder: images.displayOrder })
        .from(images)
        .where(eq(images.sceneId, scene.id))
        .orderBy(desc(images.displayOrder))
        .limit(1)

    const newDisplayOrder = generateKeyBetween(lastImage?.displayOrder ?? null, null)

    const [image] = await db
        .insert(images)
        .values({
            sceneId: job.sceneId,
            displayOrder: newDisplayOrder,
            filePath: '',
            thumbnailPath: '',
            metadata: params,
        })
        .returning({ id: images.id })

    if (!image) throw new Error('Failed to create image record')

    try {
        const { filePath, thumbnailPath } = await imageService.save(
            project.id,
            scene.id,
            image.id,
            imageData,
            imageSettings,
        )

        await db.update(images).set({ filePath, thumbnailPath }).where(eq(images.id, image.id))
        domainEvents.invalidate('images')

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

export async function* runJob(jobId: number) {
    const { job, project, scene, globalSettings } = await loadJobContext(jobId)
    const startedAt = Date.now()
    log.info({ jobId, sceneId: job.sceneId, projectId: job.projectId }, 'Processing job')

    const vibeTransfers = await vibeImageService.checkVibesForProject(
        project.id,
        globalSettings.novelai.apiKey,
        project.parameters.model,
    )

    const sourcePrompt: Prompt = {
        prompt: project.prompt,
        negativePrompt: project.negativePrompt,
        characterPrompts: project.characterPrompts,
    }

    const compiledVars = compileVariables(
        globalSettings.globalVariables,
        project.variables,
        scene.variations,
    )
    const compiledPrompts = compilePrompts(sourcePrompt, compiledVars)
    log.debug({ jobId, promptCount: compiledPrompts.length }, 'Prompts compiled')

    let remainingCount = job.variationCount

    for (const prompt of compiledPrompts) {
        const params: SimpleNovelAIParameters = {
            ...project.parameters,

            prompt: prompt.prompt,
            negativePrompt: prompt.negativePrompt,
            characterPrompts: prompt.characterPrompts,

            vibeTransfers,
            seed: project.parameters.seed ?? Math.floor(Math.random() * 1_000_000_000),
        }

        log.debug({ jobId, seed: params.seed }, 'Generating image')

        const variationStart = Date.now()
        await generateAndSaveImage(
            job,
            project,
            scene,
            params,
            globalSettings.novelai.apiKey,
            globalSettings.image,
        )
        const variationDuration = Date.now() - variationStart

        remainingCount--
        await db
            .update(queueItems)
            .set({ variationCount: remainingCount })
            .where(eq(queueItems.id, jobId))

        yield variationDuration
    }

    await db.delete(queueItems).where(eq(queueItems.id, jobId))
    log.info({ jobId, duration: (Date.now() - startedAt) / 1000 }, 'Job completed')
}
