import { zValidator } from '@hono/zod-validator'
import {
    type ImportOptions,
    NOVEL_AI_NOISE_SCHEDULES,
    NOVEL_AI_SAMPLERS,
    type Parameters,
    SdStudioImportBody,
} from '@nai-factory/shared'
import { desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db, projects, scenes, sceneVariations } from '@/db'
import logger from '@/logger'
import { parseSdStudioFile } from '@/services'
import { nextDisplayOrder } from '@/services/order'
import { requireEntity, withUpdatedAt } from '@/utils'

const log = logger.child({ module: 'sd-studio-domain' })

const VALID_SAMPLERS = new Set<string>(NOVEL_AI_SAMPLERS)
const VALID_NOISE_SCHEDULES = new Set<string>(NOVEL_AI_NOISE_SCHEDULES)

function promptTemplate(frontPrompt = '', backPrompt = '') {
    return [frontPrompt.trim(), '<<prompt>>', backPrompt.trim()].filter(Boolean).join(', ')
}

async function getProject(projectId: number) {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId))
    return requireEntity(project, 'Project not found')
}

function buildProjectUpdates(
    project: typeof projects.$inferSelect,
    preset: ReturnType<typeof parseSdStudioFile>['preset'],
    options: ImportOptions,
) {
    const updates: Partial<typeof projects.$inferInsert> = {}
    if (!preset) return updates

    if (options.importPrompt) updates.prompt = promptTemplate(preset.frontPrompt, preset.backPrompt)
    if (options.importNegativePrompt && preset.uc != null) updates.negativePrompt = preset.uc
    if (options.importCharacterPrompts && preset.characterPrompts) {
        updates.characterPrompts = preset.characterPrompts.map((prompt) => ({
            enabled: prompt.enabled ?? true,
            center: prompt.center ?? { x: 0.5, y: 0.5 },
            prompt: prompt.prompt ?? '',
            uc: prompt.uc ?? '',
        }))
    }

    if (options.importParameters) {
        const current = project.parameters as Parameters
        const sampler =
            preset.sampling && VALID_SAMPLERS.has(preset.sampling)
                ? (preset.sampling as Parameters['sampler'])
                : current.sampler
        const noiseSchedule =
            preset.noiseSchedule && VALID_NOISE_SCHEDULES.has(preset.noiseSchedule)
                ? (preset.noiseSchedule as Parameters['noiseSchedule'])
                : current.noiseSchedule

        updates.parameters = {
            ...current,
            ...(preset.steps != null ? { steps: preset.steps } : {}),
            ...(preset.promptGuidance != null ? { promptGuidance: preset.promptGuidance } : {}),
            ...(preset.cfgRescale != null ? { promptGuidanceRescale: preset.cfgRescale } : {}),
            ...(preset.varietyPlus != null ? { varietyPlus: preset.varietyPlus } : {}),
            sampler,
            noiseSchedule,
        }
    }

    return updates
}

async function getLastOrder(projectId: number) {
    const [lastScene] = await db
        .select({ displayOrder: scenes.displayOrder })
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(desc(scenes.displayOrder))
        .limit(1)

    return lastScene?.displayOrder ?? null
}

function variationOrder(index: number) {
    return index.toString().padStart(8, '0')
}

async function importToProject(projectId: number, rawData: unknown, options: ImportOptions = {}) {
    const project = await getProject(projectId)
    const pack = parseSdStudioFile(rawData)
    const updates = buildProjectUpdates(project, pack.preset, options)

    if (Object.keys(updates).length > 0) {
        await db.update(projects).set(withUpdatedAt(updates)).where(eq(projects.id, projectId))
        log.debug({ projectId, fields: Object.keys(updates) }, 'Project preset imported')
    }

    const created = []
    let variationCount = 0
    if (options.importScenes !== false) {
        let previousOrder = await getLastOrder(projectId)
        for (const item of pack.scenes) {
            const displayOrder = nextDisplayOrder(previousOrder)
            const [scene] = await db
                .insert(scenes)
                .values({
                    projectId,
                    name: item.name,
                    displayOrder,
                })
                .returning()
            if (!scene) throw new Error('Failed to insert scene')
            if (item.variations.length > 0) {
                await db.insert(sceneVariations).values(
                    item.variations.map((variables, index) => ({
                        sceneId: scene.id,
                        displayOrder: variationOrder(index),
                        variables,
                    })),
                )
                variationCount += item.variations.length
            }
            created.push({ ...scene, variations: [] })
            previousOrder = displayOrder
        }
    }

    log.info(
        {
            event: 'sd_studio.import.completed',
            projectId,
            sourceName: pack.name,
            importedScenes: created.length,
            importedVariations: variationCount,
            presetImported: Object.keys(updates).length > 0,
        },
        'SD Studio import completed',
    )

    return { imported: created.length, scenes: created }
}

export const sdStudio = new Hono().post(
    '/import',
    zValidator('json', SdStudioImportBody),
    async (c) => {
        const { projectId, data, options } = c.req.valid('json')
        return c.json(await importToProject(projectId, data, options ?? {}), 201)
    },
)
