import { desc, eq } from 'drizzle-orm'
import { generateKeyBetween } from 'fractional-indexing-jittered'
import { db, images, projects, queueItems, scenes, settings } from '@/db'
import logger from '@/logger'
import type { Parameters, Prompt } from '@/types'
import { imageService } from './image'
import { naiService, type GenerationParams, type ResolvedPrompts } from './novelai'
import { compilePrompts, compileVariables } from './prompt'

const log = logger.child({ module: 'queue-runner' })

export async function runJob(jobId: number) {
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
    const [globalSettings] = await db
        .select({
            novelaiApiKey: settings.novelaiApiKey,
            globalVariables: settings.globalVariables,
        })
        .from(settings)
    if (!globalSettings) throw new Error('Settings not found')

    const apiKey = globalSettings.novelaiApiKey.trim()
    if (!apiKey) throw new Error('NovelAI API key not set. Configure it in Settings.')

    // Load project
    const getProject = db
        .select()
        .from(projects)
        .where(eq(projects.id, job.projectId))
        .limit(1)
        .then((r) => r[0])
        .then((proj) => {
            if (!proj) throw new Error(`Project ${job.projectId} not found`)
            return proj
        })
    const getScene = db
        .select()
        .from(scenes)
        .where(eq(scenes.id, job.sceneId))
        .limit(1)
        .then((r) => r[0])
        .then((scene) => {
            if (!scene) throw new Error(`Scene ${job.sceneId} not found`)
            return scene
        })
    const [project, scene] = await Promise.all([getProject, getScene])

    const sourcePrompt: Prompt = {
        prompt: project.prompt,
        negativePrompt: project.negativePrompt,
        characterPrompts: project.characterPrompts,
    }

    // Compile variables (global + project + scene variations)
    const compiledVars = compileVariables(
        globalSettings.globalVariables,
        project.variables,
        scene.variations,
    )

    // Compile prompts with variables
    const compiledPrompts = compilePrompts(sourcePrompt, compiledVars)

    for (const prompt of compiledPrompts) {
    }
}
