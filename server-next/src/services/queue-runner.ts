import { asc, eq } from 'drizzle-orm'
import { generateKeyBetween } from 'fractional-indexing-jittered'
import {
    characterPrompts,
    db,
    images,
    projects,
    queueItems,
    scenes,
    settings,
    variations,
} from '@/db'
import logger from '@/logger'
import type { CompiledCharacterPrompt, NovelAICharacterPrompt, Prompt } from '@/types'
import { imageService } from './image'
import { generateImage } from './novelai'
import { compilePrompts, compileVariables } from './prompt'
import { checkVibesForProject } from './vibe-image'

const log = logger.child({ module: 'queue-runner' })

export async function runJob(jobId: number): Promise<number | null> {
    // Get job from database
    const job = await db
        .select()
        .from(queueItems)
        .where(eq(queueItems.id, jobId))
        .limit(1)
        .then((r) => r[0])
    if (!job) return null

    log.info({ jobId, sceneId: job.sceneId }, 'Processing job')
    const startedAt = Date.now()

    // Load global settings
    const [globalSettings] = await db.select().from(settings)
    if (!globalSettings) throw new Error('Settings not found')

    const apiKey = globalSettings.novelaiSettings.novelaiApiKey.trim()
    if (!apiKey) throw new Error('NovelAI API key not set. Configure it in Settings.')

    const naiSettings = globalSettings.novelaiSettings

    // Load project + scene + character prompts in parallel
    const [project, scene, charPrompts] = await Promise.all([
        db
            .select()
            .from(projects)
            .where(eq(projects.id, job.projectId))
            .then((r) => r[0]),
        db
            .select()
            .from(scenes)
            .where(eq(scenes.id, job.sceneId))
            .then((r) => r[0]),
        db
            .select()
            .from(characterPrompts)
            .where(eq(characterPrompts.projectId, job.projectId))
            .orderBy(asc(characterPrompts.displayOrder)),
    ])

    if (!project) throw new Error(`Project ${job.projectId} not found`)
    if (!scene) throw new Error(`Scene ${job.sceneId} not found`)

    // Build source prompt from project + normalized character prompts
    const compiledChars: CompiledCharacterPrompt[] = charPrompts.map((c) => ({
        enabled: c.enabled,
        prompt: c.prompt,
        uc: c.uc,
    }))

    const sourcePrompt: Prompt = {
        prompt: project.prompt,
        negativePrompt: project.negativePrompt,
        characterPrompts: compiledChars,
    }

    // Load variations for this scene
    const sceneVariations = await db
        .select()
        .from(variations)
        .where(eq(variations.sceneId, job.sceneId))
        .orderBy(asc(variations.displayOrder))

    const variationVars = sceneVariations.map((v) => v.variables)

    // Compile variables (global < project < variation)
    const compiledVars = compileVariables(
        globalSettings.globalVariables,
        project.variables,
        variationVars.length > 0 ? variationVars : [{}], // At least one empty set
    )

    // Compile prompts with variables
    const compiledPrompts = compilePrompts(sourcePrompt, compiledVars)

    // Load vibe transfers (encode if needed)
    const vibeImages = await checkVibesForProject(job.projectId, apiKey, naiSettings.model)

    // Build NovelAI character prompts from DB character prompts
    const naiCharPrompts: NovelAICharacterPrompt[] = charPrompts
        .filter((c) => c.enabled)
        .map((c) => ({
            enabled: true,
            center: { x: c.centerX, y: c.centerY },
            prompt: c.prompt,
            uc: c.uc,
        }))

    for (const prompt of compiledPrompts) {
        // TODO: Generate image via NovelAI API
        // const { imageData, seed } = await generateImage(apiKey, { ...params })
        // const saved = await imageService.saveImage(...)
        // await db.insert(images).values(...)
    }

    // Remove completed job
    await db.delete(queueItems).where(eq(queueItems.id, jobId))

    const durationSeconds = (Date.now() - startedAt) / 1000
    log.info({ jobId, durationSeconds }, 'Job completed')

    return durationSeconds
}
