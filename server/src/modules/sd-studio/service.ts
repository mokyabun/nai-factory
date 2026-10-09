import {
    DEFAULT_CHARACTER_CENTER,
    NOVEL_AI_NOISE_SCHEDULES,
    NOVEL_AI_SAMPLERS,
    type NovelAINoiseSchedule,
    type NovelAISampler,
    type ParametersPatch,
    PROMPT_GUIDANCE_MAX,
    type ProjectPatch,
    type SdStudioImportOptions,
    STEPS_MAX,
} from '@nai-factory/shared'

import type { AppContext } from '@/context'
import { badRequest } from '@/lib/http'
import * as projects from '@/modules/projects/service'
import * as scenes from '@/modules/scenes/service'

import { type ParsedScenePack, parseSdStudioFile, type SdPreset } from './parser'

const SAMPLERS = new Set<string>(NOVEL_AI_SAMPLERS)
const NOISE_SCHEDULES = new Set<string>(NOVEL_AI_NOISE_SCHEDULES)

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function promptTemplate(frontPrompt = '', backPrompt = '') {
    return [frontPrompt.trim(), '<<prompt>>', backPrompt.trim()].filter(Boolean).join(', ')
}

function presetParameters(preset: SdPreset): ParametersPatch {
    const patch: ParametersPatch = {}
    if (preset.steps != null) patch.steps = clamp(Math.round(preset.steps), 1, STEPS_MAX)
    if (preset.promptGuidance != null) {
        patch.promptGuidance = clamp(preset.promptGuidance, 0, PROMPT_GUIDANCE_MAX)
    }
    if (preset.cfgRescale != null) patch.promptGuidanceRescale = clamp(preset.cfgRescale, 0, 1)
    if (preset.varietyPlus != null) patch.varietyPlus = preset.varietyPlus
    if (preset.sampling && SAMPLERS.has(preset.sampling)) {
        patch.sampler = preset.sampling as NovelAISampler
    }
    if (preset.noiseSchedule && NOISE_SCHEDULES.has(preset.noiseSchedule)) {
        patch.noiseSchedule = preset.noiseSchedule as NovelAINoiseSchedule
    }
    return patch
}

export function buildProjectPatch(preset: SdPreset | undefined, options: SdStudioImportOptions) {
    const patch: ProjectPatch = {}
    if (!preset) return patch

    if (options.importPrompt) patch.prompt = promptTemplate(preset.frontPrompt, preset.backPrompt)
    if (options.importNegativePrompt && preset.uc != null) patch.negativePrompt = preset.uc
    if (options.importCharacterPrompts && preset.characterPrompts) {
        patch.characterPrompts = preset.characterPrompts.map((prompt) => ({
            enabled: prompt.enabled ?? true,
            center: prompt.center ?? { ...DEFAULT_CHARACTER_CENTER },
            prompt: prompt.prompt ?? '',
            uc: prompt.uc ?? '',
        }))
    }
    if (options.importParameters) patch.parameters = presetParameters(preset)
    return patch
}

export function importToProject(
    ctx: AppContext,
    projectId: number,
    data: unknown,
    options: SdStudioImportOptions = {},
) {
    let pack: ParsedScenePack
    try {
        pack = parseSdStudioFile(data)
    } catch (error) {
        throw badRequest(error instanceof Error ? error.message : 'Invalid SD Studio file')
    }

    const patch = buildProjectPatch(pack.preset, options)
    const items =
        options.importScenes === false
            ? []
            : pack.scenes.map((scene) => ({
                  name: scene.name,
                  variations: scene.variations.map((variables) => ({ variables })),
              }))

    const result = ctx.db.transaction((tx) => {
        if (Object.keys(patch).length > 0) projects.applyPatch(tx, projectId, patch)
        return scenes.importScenes(tx, projectId, items, 'append')
    })

    ctx.log.info(
        { event: 'sd_studio.imported', projectId, source: pack.name, imported: result.imported },
        'SD Studio import completed',
    )
    return { imported: result.imported }
}
