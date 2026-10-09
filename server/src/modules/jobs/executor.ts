import {
    type CharacterPrompt,
    isNovelAIV5Model,
    type JobErrorKind,
    type Parameters,
    type Prompt,
    SEED_MAX,
    supportsCharacterReference,
} from '@nai-factory/shared'

import type { AppContext } from '@/context'
import type { DbOrTx } from '@/db'
import { NovelAIError } from '@/integrations/novelai/errors'
import { createMockImage } from '@/integrations/novelai/mock'
import type { GenerationInput } from '@/integrations/novelai/request'
import * as assets from '@/modules/assets/service'
import * as images from '@/modules/images/service'
import * as playground from '@/modules/playground/service'
import * as projects from '@/modules/projects/service'
import * as references from '@/modules/references/service'
import * as scenes from '@/modules/scenes/service'

import * as repo from './repo'

/** A problem with settings or project configuration rather than with NovelAI. */
export class JobConfigError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'JobConfigError'
    }
}

export function classifyError(error: unknown): JobErrorKind {
    if (error instanceof JobConfigError) return 'config'
    if (error instanceof scenes.PromptRenderError) return 'prompt'
    if (error instanceof NovelAIError) {
        switch (error.kind) {
            case 'auth':
                return 'auth'
            case 'rate_limit':
                return 'rate_limit'
            case 'timeout':
            case 'network':
            case 'server':
                return 'network'
            default:
                return 'runtime'
        }
    }
    return 'runtime'
}

export type ExecutionHooks = {
    /** False once a stop was requested; the job pauses before its next image. */
    shouldContinue(): boolean
    imageStarted(done: number, total: number): void
    imageSaved(done: number, total: number, durationMs: number): void
}

/** `stopped` returns the job to the queue; `deleted` means its scene or row disappeared. */
export type ExecutionOutcome = 'completed' | 'stopped' | 'deleted'

export function randomSeed() {
    return 1 + Math.floor(Math.random() * SEED_MAX)
}

function generationMetadata(input: GenerationInput, context: Record<string, unknown>) {
    const p = input.parameters
    const isV5 = isNovelAIV5Model(p.model)
    return {
        generator: 'nai-factory',
        ...context,
        generatedAt: new Date().toISOString(),
        prompt: input.prompt,
        negativePrompt: input.negativePrompt,
        characterPrompts: input.characterPrompts,
        parameters: {
            model: p.model,
            width: p.width,
            height: p.height,
            steps: p.steps,
            promptGuidance: p.promptGuidance,
            promptGuidanceRescale: p.promptGuidanceRescale,
            sampler: p.sampler,
            noiseSchedule: isV5 ? 'karras' : p.noiseSchedule,
            seed: p.seed,
            qualityToggle: p.qualityToggle,
            varietyPlus: !isV5 && p.varietyPlus,
            normalizeReferenceStrengthValues: !isV5 && p.normalizeReferenceStrengthValues,
            useCharacterPositions: p.useCharacterPositions,
        },
        vibeTransfers: input.vibes.map((ref) => ({ strength: ref.strength })),
        characterReferences: input.characterReferences.map((ref) => ({
            strength: ref.strength,
            fidelity: ref.fidelity,
            mode: ref.mode,
        })),
    }
}

function requireApiKey(ctx: AppContext) {
    const mode = ctx.settings.get().novelai.mode
    if (mode !== 'live') return null
    const apiKey = ctx.settings.apiKey()
    if (!apiKey) throw new JobConfigError('NovelAI API key is not set')
    return apiKey
}

async function generate(
    ctx: AppContext,
    input: GenerationInput,
    signal: AbortSignal,
    context: Record<string, unknown>,
) {
    const mode = ctx.settings.get().novelai.mode
    if (mode === 'fail') throw new JobConfigError('NovelAI test failure mode is enabled')
    if (mode === 'mock') {
        signal.throwIfAborted()
        return createMockImage({ ...input.parameters, prompt: input.prompt })
    }

    const apiKey = requireApiKey(ctx) as string
    const image = await ctx.novelai.generateImage(apiKey, input, { signal, context })
    ctx.anlasCache.invalidate()
    return image
}

/** Encodes the generated image and its thumbnail outside any transaction. */
async function prepareImages(
    ctx: AppContext,
    data: Uint8Array,
    target: { kind: 'image' | 'playground_image'; relDir: string; thumbDir: string },
    metadata: Record<string, unknown>,
) {
    const settings = ctx.settings.get().image
    const source = await assets.prepareImage(ctx, data, {
        kind: target.kind,
        relDir: target.relDir,
        saveType: settings.sourceType,
        metadata,
    })
    try {
        const thumb = await assets.prepareImage(ctx, data, {
            kind: target.kind === 'image' ? 'image_thumb' : 'playground_thumb',
            relDir: target.thumbDir,
            saveType: settings.thumbnailType,
            maxSize: settings.thumbnailSize,
        })
        return { source, thumb }
    } catch (error) {
        await assets.discard(ctx, [source])
        throw error
    }
}

function isActive(tx: DbOrTx, jobId: number) {
    return repo.getById(tx, jobId)?.status === 'running'
}

type SceneContext = {
    project: ReturnType<typeof projects.toEntity>
    scene: scenes.SceneRow
    prompts: Prompt[]
}

/** Loads the latest project, scene and variation, so edits after enqueueing apply. */
function loadSceneContext(ctx: AppContext, job: repo.JobRow): SceneContext | null {
    if (job.sceneId === null || job.variationId === null || job.projectId === null) return null
    const projectRow = projects.getRow(ctx.db, job.projectId)
    const scene = scenes.getRow(ctx.db, job.sceneId)
    const variation = scenes.getVariationRow(ctx.db, job.variationId)
    if (!projectRow || !scene || !variation || variation.sceneId !== scene.id) return null

    const project = projects.toEntity(projectRow)
    const compiled = scenes.renderPrompts(ctx, project, project.variables, [variation.variables])
    const prompts = compiled.flatMap((prompt) =>
        Array.from({ length: job.repeatCount }, () => prompt),
    )
    return { project, scene, prompts }
}

async function buildInput(
    ctx: AppContext,
    projectId: number,
    prompt: Prompt,
    parameters: Parameters,
    signal: AbortSignal,
) {
    const model = parameters.model
    const seeded = { ...parameters, seed: parameters.seed || randomSeed() }
    const base = {
        prompt: prompt.prompt,
        negativePrompt: prompt.negativePrompt,
        characterPrompts: prompt.characterPrompts,
        parameters: seeded,
    }

    // V5 models support neither reference type, so they are skipped rather than failing.
    if (isNovelAIV5Model(model)) {
        return { input: { ...base, vibes: [], characterReferences: [] }, uploads: null }
    }
    if (
        references.hasEnabledCharacterReferences(ctx.db, projectId) &&
        !supportsCharacterReference(model)
    ) {
        throw new JobConfigError('Character Reference requires a V4.5 model')
    }

    const mode = ctx.settings.get().novelai.mode
    if (mode !== 'live') {
        return { input: { ...base, vibes: [], characterReferences: [] }, uploads: null }
    }

    const prepared = await references.prepareForGeneration(
        ctx,
        projectId,
        model,
        requireApiKey(ctx) as string,
        signal,
    )
    return {
        input: {
            ...base,
            vibes: prepared.vibes,
            characterReferences: prepared.characterReferences,
        },
        uploads: prepared.uploads,
    }
}

export async function runSceneJob(
    ctx: AppContext,
    jobId: number,
    signal: AbortSignal,
    hooks: ExecutionHooks,
): Promise<ExecutionOutcome> {
    while (true) {
        signal.throwIfAborted()
        const job = repo.getById(ctx.db, jobId)
        if (!job || job.status !== 'running') return 'deleted'

        const loaded = loadSceneContext(ctx, job)
        if (!loaded) return 'deleted'
        const { project, scene, prompts } = loaded

        const total = prompts.length
        if (job.totalImages !== total) repo.update(ctx.db, jobId, { totalImages: total })
        const index = job.doneImages
        if (index >= total) return 'completed'
        if (!hooks.shouldContinue()) return 'stopped'

        requireApiKey(ctx)
        hooks.imageStarted(index, total)
        const startedAt = Date.now()
        const context = {
            jobId,
            projectId: project.id,
            projectName: project.name,
            sceneId: scene.id,
            sceneName: scene.name,
            variationId: job.variationId,
        }

        const { input, uploads } = await buildInput(
            ctx,
            project.id,
            prompts[index] as Prompt,
            project.parameters,
            signal,
        )
        const data = await generate(ctx, input, signal, context)
        const metadata = generationMetadata(input, context)
        const prepared = await prepareImages(
            ctx,
            data,
            {
                kind: 'image',
                relDir: `images/${project.id}/${scene.id}`,
                thumbDir: `thumbs/${project.id}/${scene.id}`,
            },
            metadata,
        )

        let saved = false
        try {
            saved = ctx.db.transaction((tx) => {
                if (!isActive(tx, jobId) || !scenes.getRow(tx, scene.id)) return false
                const source = assets.insertPrepared(tx, prepared.source)
                const thumb = assets.insertPrepared(tx, prepared.thumb)
                images.insertGenerated(tx, {
                    sceneId: scene.id,
                    variationId: job.variationId,
                    assetId: source.id,
                    thumbAssetId: thumb.id,
                    seed: input.parameters.seed,
                    metadata,
                })
                if (uploads) references.markUploaded(tx, uploads)
                repo.update(tx, jobId, { doneImages: index + 1, totalImages: total })
                return true
            })
        } finally {
            if (!saved) await assets.discard(ctx, [prepared.source, prepared.thumb])
        }
        if (!saved) return 'deleted'

        ctx.events.publish({
            type: 'scene.images.changed',
            projectId: project.id,
            sceneId: scene.id,
        })
        hooks.imageSaved(index + 1, total, Date.now() - startedAt)
    }
}

export async function runPlaygroundJob(
    ctx: AppContext,
    jobId: number,
    signal: AbortSignal,
    hooks: ExecutionHooks,
): Promise<ExecutionOutcome> {
    while (true) {
        signal.throwIfAborted()
        const job = repo.getById(ctx.db, jobId)
        if (!job || job.status !== 'running' || !job.payload) return 'deleted'

        const total = job.repeatCount
        if (job.totalImages !== total) repo.update(ctx.db, jobId, { totalImages: total })
        const index = job.doneImages
        if (index >= total) return 'completed'
        if (!hooks.shouldContinue()) return 'stopped'

        requireApiKey(ctx)
        hooks.imageStarted(index, total)
        const startedAt = Date.now()
        const snapshot = job.payload
        const characterPrompts: CharacterPrompt[] = []
        const input: GenerationInput = {
            prompt: snapshot.prompt,
            negativePrompt: snapshot.negativePrompt,
            characterPrompts,
            parameters: { ...snapshot.parameters, seed: snapshot.parameters.seed || randomSeed() },
            vibes: [],
            characterReferences: [],
        }
        const context = { jobId, source: 'playground' }
        const data = await generate(ctx, input, signal, context)
        const metadata = generationMetadata(input, context)
        const prepared = await prepareImages(
            ctx,
            data,
            {
                kind: 'playground_image',
                relDir: 'playground/images',
                thumbDir: 'playground/thumbs',
            },
            metadata,
        )

        let saved = false
        try {
            saved = ctx.db.transaction((tx) => {
                if (!isActive(tx, jobId)) return false
                const source = assets.insertPrepared(tx, prepared.source)
                const thumb = assets.insertPrepared(tx, prepared.thumb)
                playground.insertImage(tx, {
                    assetId: source.id,
                    thumbAssetId: thumb.id,
                    prompt: snapshot.prompt,
                    negativePrompt: snapshot.negativePrompt,
                    parameters: snapshot.parameters,
                    seed: input.parameters.seed,
                    metadata,
                })
                repo.update(tx, jobId, { doneImages: index + 1, totalImages: total })
                return true
            })
        } finally {
            if (!saved) await assets.discard(ctx, [prepared.source, prepared.thumb])
        }
        if (!saved) return 'deleted'

        ctx.events.publish({ type: 'playground.images.changed' })
        hooks.imageSaved(index + 1, total, Date.now() - startedAt)
    }
}
