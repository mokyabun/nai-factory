export type ImageSaveType =
    | { type: 'png' }
    | { type: 'webp'; quality: number }
    | { type: 'avif'; quality: number }

export type Settings = {
    novelai?: { apiKey?: string }
    globalVariables?: Record<string, string>
    image?: {
        sourceType?: ImageSaveType
        thumbnailType?: ImageSaveType
        thumbnailSize?: number
    }
}

export type SceneImage = {
    id: number
    filePath: string
    thumbnailPath?: string | null
}

export type Scene = {
    id: number
    projectId: number
    name: string
    displayOrder?: string
    queueCount?: number | null
    imageCount?: number | null
    latestImages?: SceneImage[] | null
    variations?: Record<string, string>[] | null
}

export type ImageItem = {
    id: number
    filePath: string
    thumbnailPath?: string | null
}

export type GroupData = {
    id: number
    name: string
    projects: { id: number; name: string }[]
}

export type CharacterPrompt = {
    enabled: boolean
    center: { x: number; y: number }
    prompt: string
    uc: string
}

export type ProjectParams = {
    model: string
    qualityToggle: boolean
    width: number
    height: number
    steps: number
    promptGuidance: number
    varietyPlus: boolean
    seed: number
    sampler: string
    promptGuidanceRescale: number
    noiseSchedule: string
    normalizeReferenceStrengthValues: boolean
    useCharacterPositions: boolean
}

export type ProjectData = {
    id: number
    name?: string
    prompt?: string | null
    negativePrompt?: string | null
    variables?: Record<string, string> | null
    parameters: ProjectParams
    characterPrompts?: CharacterPrompt[] | null
}

export type QueueStatus = {
    running: boolean
    processing?: boolean
    count?: number
    pendingCount?: number
    estimatedSeconds?: number | null
    currentSceneId: number | null
}

export type VibeTransfer = {
    id: number
    projectId: number
    displayOrder: string
    sourceImagePath: string
    referenceStrength: number
    informationExtracted: number
}
