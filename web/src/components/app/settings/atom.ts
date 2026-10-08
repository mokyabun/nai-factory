import type {
    GlobalSettings,
    ImageSaveType,
    NovelAIMode,
    PromptVariable,
    SettingsPatch,
} from '@nai-factory/shared'
import { atom } from 'jotai'

export type ImageFormat = ImageSaveType['type']

export type SettingsDraft = {
    novelAIMode: NovelAIMode
    globalVars: PromptVariable
    sourceFormat: ImageFormat
    sourceQuality: number
    thumbFormat: ImageFormat
    thumbQuality: number
    thumbSize: number
    debugEnabled: boolean
    debugRequestLimit: number
    loaded: boolean
}

const defaultSettingsDraft: SettingsDraft = {
    novelAIMode: 'live',
    globalVars: [],
    sourceFormat: 'png',
    sourceQuality: 90,
    thumbFormat: 'webp',
    thumbQuality: 80,
    thumbSize: 256,
    debugEnabled: false,
    debugRequestLimit: 20,
    loaded: false,
}

export const settingsDraftAtom = atom<SettingsDraft>(defaultSettingsDraft)

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

            return {
                key: update.key ?? entry.key,
                value: update.value ?? entry.value,
            }
        }),
    }
}

export function addGlobalVar(draft: SettingsDraft): SettingsDraft {
    return {
        ...draft,
        globalVars: [...draft.globalVars, { key: '', value: '' }],
    }
}

export function removeGlobalVar(draft: SettingsDraft, index: number): SettingsDraft {
    return {
        ...draft,
        globalVars: draft.globalVars.filter((_, itemIndex) => itemIndex !== index),
    }
}

export function createSettingsDraft(settings: GlobalSettings): SettingsDraft {
    const { sourceType, thumbnailType } = settings.image

    return {
        novelAIMode: settings.novelai.mode,
        globalVars: settings.globalVariables,
        sourceFormat: sourceType.type,
        sourceQuality: sourceType.type === 'png' ? 90 : sourceType.quality,
        thumbFormat: thumbnailType.type,
        thumbQuality: thumbnailType.type === 'png' ? 80 : thumbnailType.quality,
        thumbSize: settings.image.thumbnailSize,
        debugEnabled: settings.debug.enabled,
        debugRequestLimit: settings.debug.recentRequestLimit,
        loaded: true,
    }
}

/** The complete settings value of a draft, one entry per settings section. */
export function createSettingsPatch({
    novelAIMode,
    globalVars,
    sourceFormat,
    sourceQuality,
    thumbFormat,
    thumbQuality,
    thumbSize,
    debugEnabled,
    debugRequestLimit,
}: SettingsDraft) {
    const sourceType: ImageSaveType =
        sourceFormat === 'png' ? { type: 'png' } : { type: sourceFormat, quality: sourceQuality }
    const thumbnailType: ImageSaveType =
        thumbFormat === 'png' ? { type: 'png' } : { type: thumbFormat, quality: thumbQuality }

    return {
        novelai: { mode: novelAIMode },
        globalVariables: globalVars.map((variable) => ({
            key: variable.key.trim(),
            value: variable.value,
        })),
        image: { sourceType, thumbnailType, thumbnailSize: thumbSize },
        debug: { enabled: debugEnabled, recentRequestLimit: debugRequestLimit },
    } satisfies Required<SettingsPatch>
}

export type FullSettingsPatch = ReturnType<typeof createSettingsPatch>

/** Only the sections that differ from `previous`, so other tabs' edits are not overwritten. */
export function changedSettings(previous: FullSettingsPatch | null, next: FullSettingsPatch) {
    const patch: SettingsPatch = {}
    for (const key of Object.keys(next) as (keyof FullSettingsPatch)[]) {
        if (JSON.stringify(previous?.[key]) !== JSON.stringify(next[key])) {
            Object.assign(patch, { [key]: next[key] })
        }
    }
    return patch
}
