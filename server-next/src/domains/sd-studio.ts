import { zValidator } from '@hono/zod-validator'
import { type ImportOptions, type Parameters, SdStudioImportBody } from '@nai-factory/types'
import { desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db, projects, scenes } from '#/db'
import { parseSdStudioFile } from '#/services'
import { nextDisplayOrder, requireEntity, withUpdatedAt } from '#/shared'

const VALID_SAMPLERS = new Set([
    'k_euler_ancestral',
    'k_euler',
    'k_dpmpp_2s_ancestral',
    'k_dpmpp_2m',
    'k_dpmpp_sde',
    'k_dpmpp_2m_sde',
    'dimm_v3',
])

const VALID_NOISE_SCHEDULES = new Set(['native', 'karras', 'exponential', 'polyexponential'])

function promptTemplate(frontPrompt = '', backPrompt = '') {
    return [frontPrompt.trim(), '[[prompt]]', backPrompt.trim()].filter(Boolean).join(', ')
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

async function importToProject(projectId: number, rawData: unknown, options: ImportOptions = {}) {
    const project = await getProject(projectId)
    const pack = parseSdStudioFile(rawData)
    const updates = buildProjectUpdates(project, pack.preset, options)

    if (Object.keys(updates).length > 0) {
        await db.update(projects).set(withUpdatedAt(updates)).where(eq(projects.id, projectId))
    }

    const created = []
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
                    variations: item.variations,
                })
                .returning()
            if (!scene) throw new Error('Failed to insert scene')
            created.push(scene)
            previousOrder = displayOrder
        }
    }

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
