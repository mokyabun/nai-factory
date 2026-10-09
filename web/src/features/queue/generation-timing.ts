/** Estimated progress is capped below 100% until the server confirms the image is saved. */
const MAX_ESTIMATED_RATIO = 0.95

/** Never reads the clock before `receivedAt`, so elapsed times never go negative. */
export function toServerNow(localNow: number, serverTime: string | undefined, receivedAt: number) {
    if (!serverTime) return localNow

    const offset = receivedAt - Date.parse(serverTime)
    return Math.max(localNow, receivedAt) - offset
}

export type ImageProgress = {
    /** When the image started; identifies the image so a new one restarts the bar. */
    startedAt: string
    elapsedMs: number
    estimateMs: number | null
    /** Estimated completion ratio; null when there is no estimate to compare against. */
    ratio: number | null
    overrun: boolean
}

export function imageProgress(
    imageStartedAt: string | null,
    estimateMs: number | null,
    serverNow: number,
): ImageProgress | null {
    if (!imageStartedAt) return null

    const elapsedMs = Math.max(0, serverNow - Date.parse(imageStartedAt))
    if (estimateMs === null || estimateMs <= 0) {
        return {
            startedAt: imageStartedAt,
            elapsedMs,
            estimateMs: null,
            ratio: null,
            overrun: false,
        }
    }

    return {
        startedAt: imageStartedAt,
        elapsedMs,
        estimateMs,
        ratio: Math.min(elapsedMs / estimateMs, MAX_ESTIMATED_RATIO),
        overrun: elapsedMs > estimateMs,
    }
}

/** Counts the server's estimate down between status refreshes. */
export function remainingSeconds(
    estimatedSeconds: number | null,
    serverTime: string | undefined,
    serverNow: number,
) {
    if (estimatedSeconds === null) return null
    if (!serverTime) return estimatedSeconds

    const sinceStatus = Math.max(0, serverNow - Date.parse(serverTime)) / 1000
    return Math.max(0, Math.round(estimatedSeconds - sinceStatus))
}

export function formatSeconds(seconds: number) {
    if (seconds < 60) return `${Math.max(0, Math.round(seconds))}초`

    const minutes = Math.ceil(seconds / 60)
    if (minutes < 60) return `${minutes}분`

    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`
}
