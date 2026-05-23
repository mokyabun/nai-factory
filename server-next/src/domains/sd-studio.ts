import { zValidator } from '@hono/zod-validator'
<<<<<<< HEAD
import { type ImportOptions, type Parameters, SdStudioImportBody } from '@nai-factory/types'
=======
import type { Parameters, SdStudioImportOptions } from '@nai-factory/types'
import { ImportSdStudioBody } from '@nai-factory/types'
>>>>>>> refs/remotes/origin/main
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
<<<<<<< HEAD
const VALID_NOISE_SCHEDULES = new Set(['native', 'karras', 'exponential', 'polyexponential'])

function promptTemplate(frontPrompt = '', backPrompt = '') {
=======

const VALID_NOISE_SCHEDULES = new Set(['native', 'karras', 'exponential', 'polyexponential'])

function buildPromptTemplate(frontPrompt = '', backPrompt = '') {
>>>>>>> refs/remotes/origin/main
    return [frontPrompt.trim(), '[[prompt]]', backPrompt.trim()].filter(Boolean).join(', ')
}

async function getProject(projectId: number) {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId))
    return requireEntity(project, 'Project not found')
}

function buildProjectUpdates(
    project: typeof projects.$inferSelect,
    preset: ReturnType<typeof parseSdStudioFile>['preset'],
<<<<<<< HEAD
    options: ImportOptions,
=======
    options: SdStudioImportOptions,
>>>>>>> refs/remotes/origin/main
) {
    const updates: Partial<typeof projects.$inferInsert> = {}
    if (!preset) return updates

<<<<<<< HEAD
    if (options.importPrompt) updates.prompt = promptTemplate(preset.frontPrompt, preset.backPrompt)
=======
    if (options.importPrompt)
        updates.prompt = buildPromptTemplate(preset.frontPrompt, preset.backPrompt)
>>>>>>> refs/remotes/origin/main
    if (options.importNegativePrompt && preset.uc != null) updates.negativePrompt = preset.uc
    if (options.importCharacterPrompts && preset.characterPrompts) {
        updates.characterPrompts = preset.characterPrompts.map((prompt) => ({
            enabled: prompt.enabled ?? true,
            center: prompt.center ?? { x: 0.5, y: 0.5 },
            prompt: prompt.prompt ?? '',
            uc: prompt.uc ?? '',
        }))
    }
<<<<<<< HEAD
=======

>>>>>>> refs/remotes/origin/main
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
<<<<<<< HEAD

=======
>>>>>>> refs/remotes/origin/main
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

<<<<<<< HEAD
async function getLastOrder(projectId: number) {
=======
async function getLastSceneOrder(projectId: number) {
>>>>>>> refs/remotes/origin/main
    const [lastScene] = await db
        .select({ displayOrder: scenes.displayOrder })
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(desc(scenes.displayOrder))
        .limit(1)
<<<<<<< HEAD

    return lastScene?.displayOrder ?? null
}

async function importToProject(projectId: number, rawData: unknown, options: ImportOptions = {}) {
    const project = await getProject(projectId)
    const pack = parseSdStudioFile(rawData)
    const updates = buildProjectUpdates(project, pack.preset, options)
=======
    return lastScene?.displayOrder ?? null
}

async function importToProject(
    projectId: number,
    rawData: unknown,
    options: SdStudioImportOptions = {},
) {
    const project = await getProject(projectId)
    const pack = parseSdStudioFile(rawData)
    const updates = buildProjectUpdates(project, pack.preset, options)

>>>>>>> refs/remotes/origin/main
    if (Object.keys(updates).length > 0) {
        await db.update(projects).set(withUpdatedAt(updates)).where(eq(projects.id, projectId))
    }

    const created = []
    if (options.importScenes !== false) {
<<<<<<< HEAD
        let previousOrder = await getLastOrder(projectId)
=======
        let previousOrder = await getLastSceneOrder(projectId)
>>>>>>> refs/remotes/origin/main
        for (const item of pack.scenes) {
            const displayOrder = nextDisplayOrder(previousOrder)
            const [scene] = await db
                .insert(scenes)
<<<<<<< HEAD
                .values({ projectId, name: item.name, displayOrder, variations: item.variations })
=======
                .values({
                    projectId,
                    name: item.name,
                    displayOrder,
                    variations: item.variations,
                })
>>>>>>> refs/remotes/origin/main
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
<<<<<<< HEAD
    zValidator('json', SdStudioImportBody),
    async (c) => {
        const { projectId, data, options } = c.req.valid('json')
        return c.json(await importToProject(projectId, data, options ?? {}), 201)
=======
    zValidator('json', ImportSdStudioBody),
    async (c) => {
        const { projectId, data, options } = c.req.valid('json')
        return c.json(await importToProject(projectId, data, options))
>>>>>>> refs/remotes/origin/main
    },
)
