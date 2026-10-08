import { DEFAULT_PLAYGROUND_PARAMETERS, type PlaygroundState } from '@nai-factory/shared'
import { atom } from 'jotai'

export const DEFAULT_PLAYGROUND_STATE: PlaygroundState = {
    prompt: '',
    negativePrompt: '',
    parameters: DEFAULT_PLAYGROUND_PARAMETERS,
    updatedAt: new Date(0).toISOString(),
}

export const playgroundSettingsAtom = atom<PlaygroundState>(DEFAULT_PLAYGROUND_STATE)
