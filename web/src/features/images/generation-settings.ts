import {
    CHARACTER_GRID_STEPS,
    CharacterPrompt,
    DEFAULT_CHARACTER_CENTER,
    Parameters,
} from '@nai-factory/shared'

/** Generation settings recovered from an image's metadata. */
export type GenerationSettings = {
    prompt: string | null
    negativePrompt: string | null
    /** Null when the metadata has no character prompts recorded. */
    characterPrompts: CharacterPrompt[] | null
    /** Parameters that were recorded and still valid; missing or invalid ones are left out. */
    parameters: Partial<Omit<Parameters, 'seed'>>
    /** The seed the image was actually generated with; null when it was not recorded. */
    seed: number | null
    /** Recorded inputs that cannot be restored from metadata alone. */
    references: {
        vibeTransfers: number
        characterReferences: number
    }
}

/** `image` reuses the image's seed, `random` clears it, `keep` leaves the current seed as is. */
export type SeedMode = 'random' | 'image' | 'keep'

function readRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {}
}

function count(value: unknown) {
    return Array.isArray(value) ? value.length : 0
}

const GRID_MIN = CHARACTER_GRID_STEPS[0]
const GRID_MAX = CHARACTER_GRID_STEPS[CHARACTER_GRID_STEPS.length - 1]!

function onGrid(value: number) {
    return value >= GRID_MIN && value <= GRID_MAX ? value : DEFAULT_CHARACTER_CENTER.x
}

function readCharacterPrompts(value: unknown): CharacterPrompt[] | null {
    if (!Array.isArray(value)) return null
    return value.flatMap((item) => {
        const result = CharacterPrompt.safeParse(item)
        if (!result.success) return []
        const { center } = result.data
        return [{ ...result.data, center: { x: onGrid(center.x), y: onGrid(center.y) } }]
    })
}

export function readGenerationSettings(metadata: Record<string, unknown>): GenerationSettings {
    const recorded = readRecord(metadata.parameters)
    const parameters: Record<string, unknown> = {}

    // Parse field by field so one outdated value does not discard the rest.
    for (const [key, schema] of Object.entries(Parameters.shape)) {
        if (key === 'seed' || !(key in recorded)) continue

        const result = schema.safeParse(recorded[key])
        if (result.success) parameters[key] = result.data
    }

    const seed = Parameters.shape.seed.safeParse(recorded.seed)

    return {
        prompt: typeof metadata.prompt === 'string' ? metadata.prompt : null,
        negativePrompt:
            typeof metadata.negativePrompt === 'string' ? metadata.negativePrompt : null,
        characterPrompts: readCharacterPrompts(metadata.characterPrompts),
        parameters: parameters as GenerationSettings['parameters'],
        seed: seed.success && seed.data > 0 ? seed.data : null,
        references: {
            vibeTransfers: count(metadata.vibeTransfers),
            characterReferences: count(metadata.characterReferences),
        },
    }
}

/** Applies recovered parameters on top of `current`; seed 0 keeps generation random. */
export function applyGenerationParameters(
    current: Parameters,
    settings: GenerationSettings,
    seedMode: SeedMode,
): Parameters {
    const seed =
        seedMode === 'keep'
            ? current.seed
            : seedMode === 'image' && settings.seed !== null
              ? settings.seed
              : 0

    return { ...current, ...settings.parameters, seed }
}

/** Describes recorded inputs a Playground generation cannot reproduce, or null if none. */
export function playgroundUnsupportedNotice(settings: GenerationSettings) {
    const parts = [
        settings.references.vibeTransfers > 0 && `바이브 ${settings.references.vibeTransfers}개`,
        settings.references.characterReferences > 0 &&
            `캐릭터 레퍼런스 ${settings.references.characterReferences}개`,
    ].filter(Boolean)

    return parts.length > 0
        ? `${parts.join(', ')}는 프로젝트 전용이라 Playground에 적용되지 않습니다`
        : null
}
