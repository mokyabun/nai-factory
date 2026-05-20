import type { PromptVariable } from '../types'

interface SdSelectedWorkflow {
    workflowType: string
    presetName: string
}

export interface SdPreset {
    type: string
    name: string
    frontPrompt?: string
    backPrompt?: string
    uc?: string
    steps?: number
    promptGuidance?: number
    sampling?: string
    cfgRescale?: number
    noiseSchedule?: string
    varietyPlus?: boolean
    characterPrompts?: Array<{
        enabled?: boolean
        center?: { x: number; y: number }
        prompt?: string
        uc?: string
    }>
}

interface SdStudioFile {
    name: string
    scenes: Record<string, SdScene>
    library?: Record<string, SdLibrary>
    selectedWorkflow?: SdSelectedWorkflow
    presets?: Record<string, SdPreset[]>
}

interface SdScene {
    name: string
    slots: SdAlternative[][]
    [key: string]: unknown
}

interface SdAlternative {
    prompt: string
    enabled?: boolean
}

interface SdLibrary {
    name: string
    pieces: SdPiece[]
}

interface SdPiece {
    name: string
    prompt: string
}

export interface ParsedScenePack {
    name: string
    scenes: ParsedSceneItem[]
    preset?: SdPreset
}

export interface ParsedSceneItem {
    name: string
    /** Each variation maps to one image generation (key: prompt variable name, e.g. { prompt: "..." }) */
    variations: PromptVariable[]
}

// Matches <library_name.piece_name> refs in prompts
const LIB_REF_RE = /<([^.>]+)\.([^>]+)>/g

export function parseSdStudioFile(raw: unknown): ParsedScenePack {
    const file = raw as SdStudioFile
    if (!file.name || !file.scenes || typeof file.scenes !== 'object') {
        throw new Error('Invalid SD Studio file: missing name or scenes')
    }

    // Build library lookup: "libKey.pieceName" → prompt value
    const pieceValues = new Map<string, string>()
    if (file.library) {
        for (const [libKey, lib] of Object.entries(file.library)) {
            for (const piece of lib.pieces ?? []) {
                pieceValues.set(`${libKey}.${piece.name}`, piece.prompt ?? '')
            }
        }
    }

    const scenes: ParsedSceneItem[] = []
    for (const [key, scene] of Object.entries(file.scenes)) {
        scenes.push(expandScene(scene.name || key, scene, pieceValues))
    }

    // Find the selected preset
    let preset: SdPreset | undefined
    if (file.selectedWorkflow && file.presets) {
        const { workflowType, presetName } = file.selectedWorkflow
        const presetList = file.presets[workflowType]
        if (presetList) {
            preset = presetList.find((p) => p.name === presetName) ?? presetList[0]
        }
    }

    return { name: file.name, scenes, preset }
}

/**
 * One SD Studio scene → one app Scene with N variations.
 * Each slot group is treated as an independent variable dimension;
 * all enabled alternatives are combined via Cartesian product.
 */
function expandScene(
    name: string,
    scene: SdScene,
    pieceValues: Map<string, string>,
): ParsedSceneItem {
    const enabledGroups = (scene.slots ?? [])
        .map((group) => group.filter((alt) => alt.enabled !== false))
        .filter((group) => group.length > 0)

    if (enabledGroups.length === 0) {
        return { name, variations: [{ prompt: '' }] }
    }

    const variations: PromptVariable[] = cartesianProduct(enabledGroups).map((combo) => {
        const combined = combo
            .map((alt) => alt.prompt.trim())
            .filter(Boolean)
            .join(', ')
            .replace(LIB_REF_RE, (_, libName, pieceName) => {
                return pieceValues.get(`${libName}.${pieceName}`) ?? ''
            })

        return { prompt: cleanPrompt(combined) }
    })

    return { name, variations }
}

function cartesianProduct<T>(arrays: T[][]): T[][] {
    return arrays.reduce<T[][]>(
        (acc, group) => acc.flatMap((combo) => group.map((item) => [...combo, item])),
        [[]],
    )
}

function cleanPrompt(text: string): string {
    return text
        .replace(/,(\s*,)+/g, ',')
        .replace(/^\s*,\s*/, '')
        .replace(/\s*,\s*$/, '')
        .replace(/\s*,\s*/g, ', ')
        .trim()
}
