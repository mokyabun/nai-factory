// SD Studio JSON import parser
// Transforms SD Studio preset files into nai-factory scene pack format

export interface SdStudioFile {
    name: string
    scenes: Record<string, SdScene>
    library?: Record<string, SdLibrary>
}

interface SdScene {
    name: string
    slots: SdAlternative[][]
    mains?: unknown[]
    [key: string]: unknown
}

interface SdAlternative {
    prompt: string
    enabled?: boolean
    id?: string
}

interface SdLibrary {
    name: string
    pieces: SdPiece[]
}

interface SdPiece {
    name: string
    prompt: string
}

// ─── Output types ────────────────────────────────────────────────────────────

export interface ParsedScenePack {
    name: string
    scenes: ParsedSceneItem[]
}

export interface ParsedSceneItem {
    name: string
    /** Key-value variables for Mustache rendering */
    variables: Record<string, string>
    /** Scene-specific positive prompt */
    prompts: string
    sortOrder: number
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

// <library_name.piece_name> refs in prompts
const LIB_REF_RE = /<([^.>]+)\.([^>]+)>/g

export function parseSdStudioFile(raw: unknown): ParsedScenePack {
    const file = raw as SdStudioFile
    if (!file.name || !file.scenes || typeof file.scenes !== 'object') {
        throw new Error('Invalid SD Studio file: missing name or scenes')
    }

    // Collect library pieces: namespace.piece → value
    const pieceValues = new Map<string, string>()
    if (file.library) {
        for (const [libKey, lib] of Object.entries(file.library)) {
            if (lib.pieces) {
                for (const piece of lib.pieces) {
                    pieceValues.set(`${libKey}.${piece.name}`, piece.prompt ?? '')
                }
            }
        }
    }

    const allScenes: ParsedSceneItem[] = []
    const nameCount = new Map<string, number>()
    let sortOrder = 0

    for (const [_key, scene] of Object.entries(file.scenes)) {
        const sceneName = scene.name || _key
        const expanded = expandScene(sceneName, scene, pieceValues)

        for (const s of expanded) {
            // Deduplicate names
            const baseName = s.name.replace(/ \(\d+\)$/, '')
            const count = nameCount.get(baseName) ?? 0
            if (count > 0) {
                s.name = `${baseName} (${count + 1})`
            }
            nameCount.set(baseName, count + 1)

            s.sortOrder = sortOrder++
            allScenes.push(s)
        }
    }

    return {
        name: file.name,
        scenes: allScenes,
    }
}

function expandScene(
    baseName: string,
    scene: SdScene,
    pieceValues: Map<string, string>,
): ParsedSceneItem[] {
    const slots = scene.slots ?? []
    if (slots.length === 0) {
        return [{ name: baseName, variables: {}, prompts: '', sortOrder: 0 }]
    }

    // Filter each group to enabled alternatives only
    const enabledGroups: SdAlternative[][] = []
    for (const group of slots) {
        const enabled = group.filter((alt) => alt.enabled !== false)
        if (enabled.length > 0) {
            enabledGroups.push(enabled)
        }
    }

    if (enabledGroups.length === 0) {
        return [{ name: baseName, variables: {}, prompts: '', sortOrder: 0 }]
    }

    // Compute Cartesian product
    const combinations = cartesianProduct(enabledGroups)
    const results: ParsedSceneItem[] = []
    const needsIndex = combinations.length > 1

    for (let i = 0; i < combinations.length; i++) {
        const combo = combinations[i]
        if (!combo) continue
        const parts = combo.map((alt) => alt.prompt.trim()).filter(Boolean)
        let combined = parts.join(', ')

        // Replace <library_name.piece_name> → actual value from library
        combined = combined.replace(LIB_REF_RE, (_, libName, pieceName) => {
            return pieceValues.get(`${libName}.${pieceName}`) ?? ''
        })

        combined = cleanPrompt(combined)

        const name = needsIndex ? `${baseName}.${i + 1}` : baseName
        results.push({ name, variables: {}, prompts: combined, sortOrder: 0 })
    }

    return results
}

function cartesianProduct<T>(arrays: T[][]): T[][] {
    if (arrays.length === 0) return [[]]
    return arrays.reduce<T[][]>(
        (acc, group) => acc.flatMap((combo) => group.map((item) => [...combo, item])),
        [[]],
    )
}

function cleanPrompt(text: string): string {
    let result = text.replace(/,(\s*,)+/g, ',')
    result = result.replace(/^\s*,\s*/, '').replace(/\s*,\s*$/, '')
    result = result.replace(/\s*,\s*/g, ', ')
    return result.trim()
}
