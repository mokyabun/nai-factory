import type { SceneJsonData } from '@nai-factory/shared'

export function sanitizeFilename(value: string) {
    const sanitized = value
        .replace(/[\\/:*?"<>|]/g, '-')
        .split('')
        .map((char) => (char.charCodeAt(0) < 32 ? '-' : char))
        .join('')
        .replace(/\s+/g, ' ')
        .replace(/-+/g, '-')
        .trim()
        .replace(/^[.\s-]+|[.\s-]+$/g, '')

    return sanitized || 'asset'
}

export function sceneJsonItems(data: SceneJsonData) {
    if (Array.isArray(data)) return data
    if ('scenes' in data) return data.scenes
    return [data]
}
