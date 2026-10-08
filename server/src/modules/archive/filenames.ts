import { extname } from 'node:path'

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

export function renderOutputTemplate(
    template: string,
    values: { character: string; scene: string; number: number; extension: string },
) {
    const rendered = template
        .replaceAll('{character}', values.character)
        .replaceAll('{scene}', values.scene)
        .replaceAll('{number}', String(values.number))
        .replaceAll('{extension}', values.extension)

    const sanitized = sanitizeFilename(rendered)
    return /^\.[A-Za-z0-9]{1,8}$/.test(extname(sanitized))
        ? sanitized
        : `${sanitized}.${values.extension}`
}

/**
 * Returns `filename`, or `name-2.ext`, `name-3.ext`… — the first name not in `used`. The
 * final name is recorded, so generated names never collide with later template results (C10).
 */
export function uniqueFilename(filename: string, used: Set<string>) {
    const key = (name: string) => name.toLowerCase()
    let candidate = filename
    if (used.has(key(candidate))) {
        const ext = extname(filename)
        const base = filename.slice(0, filename.length - ext.length)
        for (let n = 2; used.has(key(candidate)); n++) candidate = `${base}-${n}${ext}`
    }
    used.add(key(candidate))
    return candidate
}
