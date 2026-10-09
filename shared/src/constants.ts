import type { Parameters } from './schemas/common'
import { DEFAULT_OUTPUT_TEMPLATE, type ProjectSettings } from './schemas/project'
import type { GlobalSettings } from './schemas/settings'

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
    sceneCardSize: 'md',
    outputTemplate: DEFAULT_OUTPUT_TEMPLATE,
    defaultImageCount: 1,
}

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
    globalVariables: [],
    image: {
        sourceType: { type: 'png' },
        thumbnailType: { type: 'webp', quality: 60 },
        thumbnailSize: 512,
    },
    debug: {
        enabled: false,
        recentRequestLimit: 20,
    },
    novelai: { mode: 'live' },
}
