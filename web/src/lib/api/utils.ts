export const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(
    /\/+$/,
    '',
)

export function apiPath(path: string) {
    return path.replace(/^\/+/, '')
}

export function toSearchParams(query?: Record<string, unknown>) {
    if (!query) return undefined

    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
        if (value !== null && value !== undefined) params.set(key, String(value))
    }

    return params
}

export function parseText(text: string) {
    if (!text) return null

    try {
        return JSON.parse(text) as unknown
    } catch {
        return text
    }
}

export function imageUrl(path: string, version?: string | number | null): string {
    const url = `${BASE_URL}/${apiPath(path)}`
    if (version === null || version === undefined || version === '') return url

    return `${url}?v=${encodeURIComponent(String(version))}`
}

export type ImageUrlResource = {
    filePath: string
    thumbnailPath?: string | null
    assetId?: number | null
    thumbnailAssetId?: number | null
    createdAt?: string | null
}

export function imageResourceUrl(resource: ImageUrlResource, variant: 'source' | 'thumbnail') {
    const useThumbnail = variant === 'thumbnail' && resource.thumbnailPath
    const path = useThumbnail ? resource.thumbnailPath : resource.filePath
    const assetId = useThumbnail ? resource.thumbnailAssetId : resource.assetId
    const version = [assetId, resource.createdAt].filter(Boolean).join('-')

    return imageUrl(path ?? resource.filePath, version)
}
