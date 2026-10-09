import { Parameters } from '@nai-factory/shared'

/** Generation settings recovered from an image's metadata. */
export type GenerationSettings = {
    prompt: string | null
    negativePrompt: string | null
    /** Parameters that were recorded and still valid; missing or invalid ones are left out. */
    parameters: Partial<Omit<Parameters, 'seed'>>
    /** The seed the image was actually generated with; null when it was not recorded. */
    seed: number | null
    /** Recorded inputs that cannot be restored from metadata alone. */
    references: {
        characterPrompts: number
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

function enabledCount(value: unknown) {
    if (!Array.isArray(value)) return 0
    return value.filter((item) => readRecord(item).enabled !== false).length
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
        parameters: parameters as GenerationSettings['parameters'],
        seed: seed.success && seed.data > 0 ? seed.data : null,
        references: {
            characterPrompts: enabledCount(metadata.characterPrompts),
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
        settings.references.characterPrompts > 0 &&
            `캐릭터 프롬프트 ${settings.references.characterPrompts}개`,
        settings.references.vibeTransfers > 0 && `바이브 ${settings.references.vibeTransfers}개`,
        settings.references.characterReferences > 0 &&
            `캐릭터 레퍼런스 ${settings.references.characterReferences}개`,
    ].filter(Boolean)

    return parts.length > 0 ? `${parts.join(', ')}는 Playground에 적용되지 않습니다` : null
}
