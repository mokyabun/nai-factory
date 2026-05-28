import type { ImportOptions as SdStudioImportOptions } from '@nai-factory/types'
import { atom } from 'jotai'

export type SdStudioImportStep = 'choose' | 'options' | 'project-name'
export type SdStudioImportOptionsDraft = Required<SdStudioImportOptions>

export interface ParsedSdStudioFile {
    raw: unknown
    name: string
    sceneCount: number
    hasPreset: boolean
}

export const createSceneNameAtom = atom('')
export const createProjectNameAtom = atom('')
export const createGroupNameAtom = atom('')

export const sdStudioImportStepAtom = atom<SdStudioImportStep>('choose')
export const parsedSdStudioFileAtom = atom<ParsedSdStudioFile | null>(null)
export const sdStudioParseErrorAtom = atom<string | null>(null)
export const sdStudioProjectNameAtom = atom('')
export const sdStudioImportOptionsAtom = atom<SdStudioImportOptionsDraft>({
    importPrompt: true,
    importNegativePrompt: true,
    importScenes: true,
    importCharacterPrompts: true,
    importParameters: true,
})
