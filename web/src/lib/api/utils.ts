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

export function imageUrl(path: string): string {
    return `${BASE_URL}/${apiPath(path)}`
}
