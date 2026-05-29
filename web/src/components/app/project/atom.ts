import type { Parameters as ProjectParams } from '@nai-factory/shared'
import { atom } from 'jotai'

export const sceneCardThumbIndexAtom = atom(0)
export const sceneCardDeleteOpenAtom = atom(false)

export const parametersPanelParamsAtom = atom<ProjectParams | null>(null)
export const parametersPanelActiveTabAtom = atom('params')

type ProjectParamUpdate = {
    key: keyof ProjectParams
    value: ProjectParams[keyof ProjectParams]
    fallback: ProjectParams
}

export function copyProjectParams(params: ProjectParams): ProjectParams {
    return { ...params }
}

export function updateProjectParams(
    current: ProjectParams | null,
    update: ProjectParamUpdate,
): ProjectParams {
    return {
        ...(current ?? update.fallback),
        [update.key]: update.value,
    }
}
