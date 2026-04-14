import type { PromptVariable } from '@/types'

interface SdStudioFile {
    name: string
    scenes: Record<string, SdScene>
    library?: Record<string, SdLibrary>
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

    return { name: file.name, scenes }
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
