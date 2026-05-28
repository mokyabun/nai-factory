import type { Parameters, PlaygroundSettings } from '@nai-factory/types'
import { atom } from 'jotai'

export type SidebarPanel = 'project' | 'playground' | 'prompt' | 'queue' | 'settings'

export const activeSidebarPanelAtom = atom<SidebarPanel>('project')

export const defaultPlaygroundParameters: Parameters = {
    model: 'nai-diffusion-4-5-full',
    qualityToggle: false,
    width: 1024,
    height: 1024,
    steps: 28,
    promptGuidance: 6,
    varietyPlus: false,
    seed: 0,
    sampler: 'k_euler_ancestral',
    promptGuidanceRescale: 0.7,
    noiseSchedule: 'karras',
    normalizeReferenceStrengthValues: false,
    useCharacterPositions: false,
}

export const defaultPlaygroundSettings: PlaygroundSettings = {
    id: 1,
    prompt: '',
    negativePrompt: '',
    parameters: defaultPlaygroundParameters,
    updatedAt: '',
}

export const playgroundSettingsAtom = atom<PlaygroundSettings>(defaultPlaygroundSettings)
