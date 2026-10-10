import type { PromptVariable } from '@nai-factory/shared'

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
    /** One image generation per variation. */
    variations: PromptVariable[]
}

/** Matches `<library.piece>` references in prompts. */
const LIB_REF_RE = /<([^.>]+)\.([^>]+)>/g

export function parseSdStudioFile(raw: unknown): ParsedScenePack {
    const { file, sceneKeyOrder } = parseSdStudioInput(raw)
    if (!file.name || !file.scenes || typeof file.scenes !== 'object') {
        throw new Error('Invalid SD Studio file: missing name or scenes')
    }

    const pieceValues = new Map<string, string>()
    if (file.library) {
        for (const [libKey, lib] of Object.entries(file.library)) {
            for (const piece of lib.pieces ?? []) {
                pieceValues.set(`${libKey}.${piece.name}`, piece.prompt ?? '')
            }
        }
    }

    const scenes: ParsedSceneItem[] = []
    for (const [key, scene] of orderedSceneEntries(file.scenes, sceneKeyOrder)) {
        scenes.push(expandScene(scene.name || key, scene, pieceValues))
    }

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

function parseSdStudioInput(raw: unknown) {
    if (typeof raw === 'string') {
        return {
            file: JSON.parse(raw) as SdStudioFile,
            sceneKeyOrder: extractSceneKeyOrder(raw),
        }
    }

    return { file: raw as SdStudioFile, sceneKeyOrder: undefined }
}

function orderedSceneEntries(scenes: Record<string, SdScene>, sceneKeyOrder?: string[]) {
    const entries = Object.entries(scenes)
    if (!sceneKeyOrder) return entries

    const used = new Set<string>()
    const ordered: Array<[string, SdScene]> = []
    for (const key of sceneKeyOrder) {
        if (!Object.hasOwn(scenes, key)) continue
        ordered.push([key, scenes[key] as SdScene])
        used.add(key)
    }

    for (const entry of entries) {
        if (!used.has(entry[0])) ordered.push(entry)
    }

    return ordered
}

function extractSceneKeyOrder(text: string) {
    try {
        let index = skipWhitespace(text, 0)
        if (text[index] !== '{') return undefined
        index += 1

        while (index < text.length) {
            index = skipWhitespace(text, index)
            if (text[index] === '}') return undefined

            const key = readJsonString(text, index)
            index = skipWhitespace(text, key.end)
            if (text[index] !== ':') return undefined
            index = skipWhitespace(text, index + 1)

            if (key.value === 'scenes') return readObjectKeys(text, index)

            index = skipJsonValue(text, index)
            index = skipWhitespace(text, index)
            if (text[index] === ',') {
                index += 1
                continue
            }
            if (text[index] === '}') return undefined
            return undefined
        }
    } catch {
        return undefined
    }
}

function readObjectKeys(text: string, start: number) {
    let index = skipWhitespace(text, start)
    if (text[index] !== '{') return undefined
    index += 1

    const keys: string[] = []
    while (index < text.length) {
        index = skipWhitespace(text, index)
        if (text[index] === '}') return keys

        const key = readJsonString(text, index)
        keys.push(key.value)

        index = skipWhitespace(text, key.end)
        if (text[index] !== ':') return undefined
        index = skipJsonValue(text, index + 1)
        index = skipWhitespace(text, index)
        if (text[index] === ',') {
            index += 1
            continue
        }
        if (text[index] === '}') return keys
        return undefined
    }
}

function skipWhitespace(text: string, start: number) {
    let index = start
    while (/\s/.test(text[index] ?? '')) index += 1
    return index
}

function readJsonString(text: string, start: number) {
    if (text[start] !== '"') throw new Error('Expected JSON string')
    let index = start + 1
    while (index < text.length) {
        const char = text[index]
        if (char === '\\') {
            index += 2
            continue
        }
        if (char === '"') {
            return {
                value: JSON.parse(text.slice(start, index + 1)) as string,
                end: index + 1,
            }
        }
        index += 1
    }
    throw new Error('Unterminated JSON string')
}

function skipJsonValue(text: string, start: number) {
    let index = skipWhitespace(text, start)
    const char = text[index]

    if (char === '"') return readJsonString(text, index).end
    if (char === '{') return skipJsonObject(text, index)
    if (char === '[') return skipJsonArray(text, index)

    while (index < text.length && !/[\s,}\]]/.test(text[index] ?? '')) index += 1
    return index
}

function skipJsonObject(text: string, start: number) {
    let index = start + 1
    while (index < text.length) {
        index = skipWhitespace(text, index)
        if (text[index] === '}') return index + 1

        const key = readJsonString(text, index)
        index = skipWhitespace(text, key.end)
        if (text[index] !== ':') throw new Error('Expected object colon')
        index = skipJsonValue(text, index + 1)
        index = skipWhitespace(text, index)
        if (text[index] === ',') {
            index += 1
            continue
        }
        if (text[index] === '}') return index + 1
        throw new Error('Expected object separator')
    }
    throw new Error('Unterminated JSON object')
}

function skipJsonArray(text: string, start: number) {
    let index = start + 1
    while (index < text.length) {
        index = skipWhitespace(text, index)
        if (text[index] === ']') return index + 1

        index = skipJsonValue(text, index)
        index = skipWhitespace(text, index)
        if (text[index] === ',') {
            index += 1
            continue
        }
        if (text[index] === ']') return index + 1
        throw new Error('Expected array separator')
    }
    throw new Error('Unterminated JSON array')
}

/** Each enabled slot group is a variable dimension; variations are their Cartesian product. */
function expandScene(
    name: string,
    scene: SdScene,
    pieceValues: Map<string, string>,
): ParsedSceneItem {
    const enabledGroups = (scene.slots ?? [])
        .map((group) => group.filter((alt) => alt.enabled !== false))
        .filter((group) => group.length > 0)

    if (enabledGroups.length === 0) {
        return { name, variations: [[{ key: 'prompt', value: '' }]] }
    }

    const variations: PromptVariable[] = cartesianProduct(enabledGroups).map((combo) => {
        const combined = combo
            .map((alt) => alt.prompt.trim())
            .filter(Boolean)
            .join(', ')
            .replace(LIB_REF_RE, (_, libName, pieceName) => {
                return pieceValues.get(`${libName}.${pieceName}`) ?? ''
            })

        return [{ key: 'prompt', value: cleanPrompt(combined) }]
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
