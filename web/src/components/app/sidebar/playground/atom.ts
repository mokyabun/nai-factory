import { DEFAULT_PLAYGROUND_SETTINGS, type PlaygroundSettings } from '@nai-factory/shared'
import { atom } from 'jotai'

export const playgroundSettingsAtom = atom<PlaygroundSettings>(DEFAULT_PLAYGROUND_SETTINGS)
