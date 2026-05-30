import type { Parameters } from './app'
import type { PlaygroundSettings } from './domains/playground'
import type { ProjectSettings } from './domains/project'
import type { GlobalSettings } from './settings'

export const DEFAULT_PROJECT_PARAMETERS: Parameters = {
    model: 'nai-diffusion-4-5-full',
    qualityToggle: false,
    width: 512,
    height: 512,
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

export const DEFAULT_PLAYGROUND_PARAMETERS: Parameters = {
    ...DEFAULT_PROJECT_PARAMETERS,
    width: 1024,
    height: 1024,
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
    slideshowImageCount: 4,
    outputTemplate: '{character}-{scene}-{number}.{extension}',
}

export const DEFAULT_PLAYGROUND_SETTINGS: PlaygroundSettings = {
    id: 1,
    prompt: '',
    negativePrompt: '',
    parameters: DEFAULT_PLAYGROUND_PARAMETERS,
    updatedAt: '',
}

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
    globalVariables: {},
    novelai: {
        apiKey: '',
    },
    image: {
        sourceType: { type: 'png' },
        thumbnailType: { type: 'webp', quality: 60 },
        thumbnailSize: 512,
    },
    debug: {
        enabled: false,
        recentRequestLimit: 20,
    },
    export: {
        serverPath: '',
    },
}
