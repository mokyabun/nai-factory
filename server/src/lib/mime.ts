export type ImageFormat = 'png' | 'jpeg' | 'webp' | 'avif'

const CONTENT_TYPES: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    avif: 'image/avif',
    json: 'application/json',
    zip: 'application/zip',
}

export const OCTET_STREAM = 'application/octet-stream'

export function contentTypeForExtension(extension: string) {
    return CONTENT_TYPES[extension.replace(/^\./, '').toLowerCase()] ?? OCTET_STREAM
}

export function contentTypeForPath(path: string) {
    const dot = path.lastIndexOf('.')
    return dot === -1 ? OCTET_STREAM : contentTypeForExtension(path.slice(dot + 1))
}

export function extensionForFormat(format: ImageFormat) {
    return format === 'jpeg' ? 'jpg' : format
}

export function contentTypeForFormat(format: ImageFormat) {
    return `image/${format}`
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0) {
    if (bytes.byteLength < offset + signature.length) return false
    return signature.every((value, index) => bytes[offset + index] === value)
}

function ascii(text: string) {
    return Array.from({ length: text.length }, (_, index) => text.charCodeAt(index))
}

export function sniffImageFormat(bytes: Uint8Array): ImageFormat | null {
    if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
    if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg'
    if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return 'webp'
    if (startsWith(bytes, ascii('ftyp'), 4)) {
        const brand = String.fromCharCode(...bytes.subarray(8, 12))
        if (brand === 'avif' || brand === 'avis') return 'avif'
    }
    return null
}
