import type { ImageMetadata } from '@nai-factory/shared'

const FALLBACK_ASPECT_RATIO = 1
const MIN_ASPECT_RATIO = 1 / 2
const MAX_ASPECT_RATIO = 2

/** Width over height, held between 1:2 and 2:1 so extreme sizes do not stretch the layout. */
export function aspectRatio({ width, height }: { width: number; height: number }) {
    return Math.min(MAX_ASPECT_RATIO, Math.max(MIN_ASPECT_RATIO, width / height))
}

/** The clamped aspect ratio of the generation parameters recorded in the metadata. */
export function recordedAspectRatio(metadata: ImageMetadata) {
    const parameters = metadata.parameters
    if (!parameters || typeof parameters !== 'object') return FALLBACK_ASPECT_RATIO

    const { width, height } = parameters as Record<string, unknown>
    return typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0
        ? aspectRatio({ width, height })
        : FALLBACK_ASPECT_RATIO
}
