import type { GlobalSettings, ImageSaveType, SettingsPatchBody } from '@nai-factory/shared'
import { atom } from 'jotai'

export type ImageFormat = ImageSaveType['type']

export type SettingsDraft = {
    apiKey: string
    globalVars: [string, string][]
    sourceFormat: ImageFormat
    sourceQuality: number
    thumbFormat: ImageFormat
    thumbQuality: number
    thumbSize: number
    debugEnabled: boolean
    debugRequestLimit: number
    serverExportPath: string
    loaded: boolean
}

const defaultSettingsDraft: SettingsDraft = {
    apiKey: '',
    globalVars: [],
    sourceFormat: 'png',
    sourceQuality: 90,
    thumbFormat: 'webp',
    thumbQuality: 80,
    thumbSize: 256,
    debugEnabled: false,
    debugRequestLimit: 20,
    serverExportPath: '',
    loaded: false,
}

export const settingsDraftAtom = atom<SettingsDraft>(defaultSettingsDraft)
export const showApiKeyAtom = atom(false)
export const debugRequestRowOpenAtom = atom(false)

export const settingsPatchAtom = atom((get) => createSettingsPatch(get(settingsDraftAtom)))

export type GlobalVarUpdate = {
    index: number
    key?: string
    value?: string
}

export function updateSettingsDraft(
    draft: SettingsDraft,
    update: Partial<SettingsDraft>,
): SettingsDraft {
    return { ...draft, ...update }
}

export function updateGlobalVar(draft: SettingsDraft, update: GlobalVarUpdate): SettingsDraft {
    return {
        ...draft,
        globalVars: draft.globalVars.map((entry, index) => {
            if (index !== update.index) return entry

            return [update.key ?? entry[0], update.value ?? entry[1]] satisfies [string, string]
        }),
    }
}

export function addGlobalVar(draft: SettingsDraft): SettingsDraft {
    return {
        ...draft,
        globalVars: [...draft.globalVars, ['', '']],
    }
}

export function removeGlobalVar(draft: SettingsDraft, index: number): SettingsDraft {
    return {
        ...draft,
        globalVars: draft.globalVars.filter((_, itemIndex) => itemIndex !== index),
    }
}

export function createSettingsDraft(settings: GlobalSettings): SettingsDraft {
    const sourceType = settings.image?.sourceType
    const thumbnailType = settings.image?.thumbnailType

    return {
        apiKey: settings.novelai?.apiKey ?? '',
        globalVars: Object.entries(settings.globalVariables ?? {}),
        sourceFormat: sourceType?.type ?? 'png',
        sourceQuality: sourceType?.type === 'png' ? 90 : (sourceType?.quality ?? 90),
        thumbFormat: thumbnailType?.type ?? 'webp',
        thumbQuality: thumbnailType?.type === 'png' ? 80 : (thumbnailType?.quality ?? 80),
        thumbSize: settings.image?.thumbnailSize ?? 256,
        debugEnabled: settings.debug?.enabled ?? false,
        debugRequestLimit: settings.debug?.recentRequestLimit ?? 20,
        serverExportPath: settings.export?.serverPath ?? '',
        loaded: true,
    }
}

export function createSettingsPatch({
    apiKey,
    globalVars,
    sourceFormat,
    sourceQuality,
    thumbFormat,
    thumbQuality,
    thumbSize,
    debugEnabled,
    debugRequestLimit,
    serverExportPath,
}: SettingsDraft): SettingsPatchBody {
    const sourceType: ImageSaveType =
        sourceFormat === 'png' ? { type: 'png' } : { type: sourceFormat, quality: sourceQuality }
    const thumbnailType: ImageSaveType =
        thumbFormat === 'png' ? { type: 'png' } : { type: thumbFormat, quality: thumbQuality }

    return {
        novelai: { apiKey },
        globalVariables: Object.fromEntries(globalVars),
        image: { sourceType, thumbnailType, thumbnailSize: thumbSize },
        debug: { enabled: debugEnabled, recentRequestLimit: debugRequestLimit },
        export: { serverPath: serverExportPath },
    }
}
