import type { Parameters } from '@nai-factory/shared'

import {
    type GenerationSettings,
    novelAIMetadata,
    readGenerationSettings,
} from '@/features/images/generation-settings'
import {
    type EmbeddedMetadata,
    readEmbeddedMetadata,
    readStealthMetadata,
} from '@/lib/image-metadata'

export type ImageSettings = {
    origin: 'nai-factory' | 'novelai'
    settings: GenerationSettings
    /** Recorded inputs that cannot be applied, as user-facing text. */
    unsupported: string[]
}

type NovelAIRecord = { comment: Record<string, unknown>; source: string | null }

const PARAMETER_LABELS: Record<keyof Parameters, string> = {
    model: '모델',
    qualityToggle: 'Quality Toggle',
    width: '너비',
    height: '높이',
    steps: '스텝',
    promptGuidance: 'CFG Scale',
    varietyPlus: 'Variety+',
    seed: '시드',
    sampler: '샘플러',
    promptGuidanceRescale: 'CFG Rescale',
    noiseSchedule: '노이즈 스케줄',
    normalizeReferenceStrengthValues: '레퍼런스 강도 정규화',
    useCharacterPositions: '캐릭터 위치',
}

function readRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null
}

function parseRecord(text: unknown): Record<string, unknown> | null {
    if (typeof text !== 'string') return readRecord(text)
    try {
        return readRecord(JSON.parse(text))
    } catch {
        return null
    }
}

function unescapeXml(value: string) {
    return value
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&apos;', "'")
        .replaceAll('&amp;', '&')
}

function naiFactoryMetadata(embedded: EmbeddedMetadata) {
    const xmp = embedded.xmp?.match(/<nai:metadata>([\s\S]*?)<\/nai:metadata>/)?.[1]
    if (xmp) return parseRecord(unescapeXml(xmp))

    const exif = parseRecord(embedded.exifDescription)
    return exif?.generator === 'nai-factory' ? exif : null
}

// Converters such as SD Studio carry NovelAI's `Comment` over into EXIF for WebP and AVIF.
function novelAIRecord(embedded: EmbeddedMetadata): NovelAIRecord | null {
    const comment = parseRecord(embedded.text.Comment) ?? parseRecord(embedded.exifDescription)
    return comment ? { comment, source: embedded.text.Source ?? null } : null
}

async function stealthRecord(file: Blob): Promise<NovelAIRecord | null> {
    const payload = parseRecord(await readStealthMetadata(file).catch(() => null))
    const comment = parseRecord(payload?.Comment)
    if (!payload || !comment) return null
    return { comment, source: typeof payload.Source === 'string' ? payload.Source : null }
}

function unsupportedParameters(metadata: Record<string, unknown>, settings: GenerationSettings) {
    const recorded = readRecord(metadata.parameters) ?? {}
    return Object.entries(PARAMETER_LABELS).flatMap(([key, label]) => {
        const value = recorded[key]
        if (key === 'seed' || value === undefined || key in settings.parameters) return []
        return [`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`]
    })
}

function referenceNotices(settings: GenerationSettings) {
    const { vibeTransfers, characterReferences } = settings.references
    return [
        vibeTransfers > 0 && `바이브 전송 ${vibeTransfers}개 (이미지는 메타데이터에 없음)`,
        characterReferences > 0 &&
            `캐릭터 레퍼런스 ${characterReferences}개 (이미지는 메타데이터에 없음)`,
    ].filter((notice) => typeof notice === 'string')
}

function novelAINotices({ comment, source }: NovelAIRecord, settings: GenerationSettings) {
    const requestType = comment.request_type
    return [
        settings.parameters.model === undefined && `모델: ${source ?? '기록 없음'}`,
        typeof requestType === 'string' &&
            requestType !== 'PromptGenerateRequest' &&
            `요청 종류: ${requestType} (원본 이미지는 메타데이터에 없음)`,
    ].filter((notice) => typeof notice === 'string')
}

/** Recovers generation settings from a dropped image; null when it carries none. */
export async function readImageSettings(file: Blob): Promise<ImageSettings | null> {
    const embedded = await readEmbeddedMetadata(new Uint8Array(await file.arrayBuffer()))

    const ownMetadata = naiFactoryMetadata(embedded)
    if (ownMetadata) {
        const settings = readGenerationSettings(ownMetadata)
        return {
            origin: 'nai-factory',
            settings,
            unsupported: [
                ...unsupportedParameters(ownMetadata, settings),
                ...referenceNotices(settings),
            ],
        }
    }

    const record = novelAIRecord(embedded) ?? (await stealthRecord(file))
    if (!record) return null

    const metadata = novelAIMetadata(record.comment, record.source)
    const settings = readGenerationSettings(metadata)
    return {
        origin: 'novelai',
        settings,
        unsupported: [
            ...novelAINotices(record, settings),
            ...unsupportedParameters(metadata, settings),
            ...referenceNotices(settings),
        ],
    }
}
