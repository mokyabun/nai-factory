import {
    CHARACTER_GRID_STEPS,
    CharacterPrompt,
    DEFAULT_CHARACTER_CENTER,
    type NovelAIModel,
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

/** Which recovered fields to apply; unselected fields keep their current value. */
export type SettingsSelection = {
    prompt: boolean
    negativePrompt: boolean
    characterPrompts: boolean
    parameters: boolean
    seed: SeedMode
    /** `append` adds the recovered prompts after the current ones instead of replacing them. */
    promptMode: 'replace' | 'append'
}

type PromptFields = {
    prompt: string
    negativePrompt: string
    characterPrompts: CharacterPrompt[]
    parameters: Parameters
}

function readRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {}
}

function count(value: unknown) {
    return Array.isArray(value) ? value.length : 0
}

function readArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : []
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

function novelAIModel(source: string): NovelAIModel | undefined {
    const text = source.toLowerCase()
    const variant = text.includes('curated') ? 'curated' : 'full'
    if (text.includes('v5')) return `nai-diffusion-5-${variant}`
    if (text.includes('v4.5')) return `nai-diffusion-4-5-${variant}`
    if (text.includes('v4')) return `nai-diffusion-4-${variant}`
    return undefined
}

type Caption = { base_caption?: unknown; char_captions?: unknown }

function captionOf(value: unknown): Caption {
    return readRecord(readRecord(value).caption)
}

/**
 * Converts the JSON NovelAI writes to a PNG's `Comment` chunk into nai-factory's metadata shape.
 * `source` is the `Source` chunk, which names the model (`NovelAI Diffusion V4.5 …`).
 */
export function novelAIMetadata(comment: Record<string, unknown>, source: string | null) {
    const caption = captionOf(comment.v4_prompt)
    const negativeCaption = captionOf(comment.v4_negative_prompt)
    const characterCaptions = readArray(caption.char_captions).map(readRecord)
    const characterUcs = readArray(negativeCaption.char_captions).map(readRecord)
    const recorded = (key: string, value: unknown) => (key in comment ? value : undefined)

    return {
        prompt: comment.prompt ?? caption.base_caption,
        negativePrompt: comment.uc ?? negativeCaption.base_caption,
        characterPrompts:
            'v4_prompt' in comment
                ? characterCaptions.map((character, index) => ({
                      enabled: true,
                      prompt: character.char_caption,
                      uc: characterUcs[index]?.char_caption ?? '',
                      center: readArray(character.centers)[0] ?? DEFAULT_CHARACTER_CENTER,
                  }))
                : undefined,
        parameters: {
            model: novelAIModel([source, comment.model_name].filter(Boolean).join(' ')),
            width: comment.width,
            height: comment.height,
            steps: comment.steps,
            promptGuidance: comment.scale,
            promptGuidanceRescale: comment.cfg_rescale,
            sampler: comment.sampler,
            noiseSchedule: comment.noise_schedule,
            seed: comment.seed,
            varietyPlus: recorded('skip_cfg_above_sigma', comment.skip_cfg_above_sigma != null),
            normalizeReferenceStrengthValues: comment.normalize_reference_strength_multiple,
            useCharacterPositions: readRecord(comment.v4_prompt).use_coords,
        },
        vibeTransfers: readArray(comment.reference_strength_multiple),
        characterReferences: readArray(comment.director_reference_strength_values),
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

function joinPrompts(current: string, added: string) {
    return [current.trim().replace(/,$/, ''), added.trim()].filter(Boolean).join(', ')
}

/** The fields `selection` changes, ready to send as a Playground or project patch. */
export function generationSettingsPatch(
    current: PromptFields,
    settings: GenerationSettings,
    selection: SettingsSelection,
): Partial<PromptFields> {
    const patch: Partial<PromptFields> = {}
    const text = (value: string, recovered: string) =>
        selection.promptMode === 'append' ? joinPrompts(value, recovered) : recovered

    if (selection.prompt && settings.prompt !== null) {
        patch.prompt = text(current.prompt, settings.prompt)
    }
    if (selection.negativePrompt && settings.negativePrompt !== null) {
        patch.negativePrompt = text(current.negativePrompt, settings.negativePrompt)
    }
    if (selection.characterPrompts && settings.characterPrompts !== null) {
        patch.characterPrompts = settings.characterPrompts
    }
    if (selection.parameters || selection.seed !== 'keep') {
        const recovered = selection.parameters ? settings : { ...settings, parameters: {} }
        patch.parameters = applyGenerationParameters(current.parameters, recovered, selection.seed)
    }
    return patch
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
