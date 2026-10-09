/** Text metadata embedded in an image file, read without decoding pixels. */
export type EmbeddedMetadata = {
    /** PNG `tEXt`/`zTXt`/`iTXt` entries by keyword. */
    text: Record<string, string>
    /** EXIF `ImageDescription` of the first IFD. */
    exifDescription: string | null
    xmp: string | null
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const XMP_KEYWORD = 'XML:com.adobe.xmp'
const XMP_START = '<x:xmpmeta'
const XMP_END = '</x:xmpmeta>'
const EXIF_IMAGE_DESCRIPTION = 0x010e
const STEALTH_MAGIC_BITS = 15 * 8
const STEALTH_LENGTH_BITS = 32

const utf8 = new TextDecoder()
// windows-1252 maps every byte to one UTF-16 unit, so string indices equal byte offsets.
const bytewise = new TextDecoder('latin1')

function ascii(bytes: Uint8Array, start: number, length: number) {
    return String.fromCharCode(...bytes.subarray(start, start + length))
}

async function decompress(data: Uint8Array, format: CompressionFormat) {
    const stream = new Blob([data.slice()]).stream().pipeThrough(new DecompressionStream(format))
    return new Uint8Array(await new Response(stream).arrayBuffer())
}

function isPng(bytes: Uint8Array) {
    return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)
}

function isWebp(bytes: Uint8Array) {
    return ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP'
}

function readTiffDescription(tiff: Uint8Array): string | null {
    // WebP writers disagree on whether the EXIF chunk keeps JPEG's `Exif\0\0` prefix.
    if (ascii(tiff, 0, 4) === 'Exif') tiff = tiff.subarray(6)
    const littleEndian = ascii(tiff, 0, 2) === 'II'
    if (!littleEndian && ascii(tiff, 0, 2) !== 'MM') return null

    try {
        const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength)
        const ifd = view.getUint32(4, littleEndian)
        const entries = view.getUint16(ifd, littleEndian)
        for (let index = 0; index < entries; index++) {
            const entry = ifd + 2 + index * 12
            if (view.getUint16(entry, littleEndian) !== EXIF_IMAGE_DESCRIPTION) continue
            const count = view.getUint32(entry + 4, littleEndian)
            const offset = count <= 4 ? entry + 8 : view.getUint32(entry + 8, littleEndian)
            return utf8.decode(tiff.subarray(offset, offset + count)).replace(/\0+$/, '')
        }
    } catch {
        return null
    }
    return null
}

function nullTerminated(data: Uint8Array, start: number) {
    const end = data.indexOf(0, start)
    return end === -1 ? null : { value: ascii(data, start, end - start), next: end + 1 }
}

// NovelAI and libvips store UTF-8 in `tEXt` although the PNG spec says Latin-1.
async function readTextChunk(type: string, data: Uint8Array) {
    const keyword = nullTerminated(data, 0)
    if (!keyword) return null

    if (type === 'tEXt')
        return { keyword: keyword.value, text: utf8.decode(data.subarray(keyword.next)) }
    if (type === 'zTXt') {
        const text = await decompress(data.subarray(keyword.next + 1), 'deflate')
        return { keyword: keyword.value, text: utf8.decode(text) }
    }

    const compressed = data[keyword.next] === 1
    const language = nullTerminated(data, keyword.next + 2)
    const translated = language && nullTerminated(data, language.next)
    if (!translated) return null
    const body = data.subarray(translated.next)
    const text = compressed ? await decompress(body, 'deflate') : body
    return { keyword: keyword.value, text: utf8.decode(text) }
}

async function readPng(bytes: Uint8Array): Promise<EmbeddedMetadata> {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const result: EmbeddedMetadata = { text: {}, exifDescription: null, xmp: null }

    for (let offset = PNG_SIGNATURE.length; offset + 8 <= bytes.length;) {
        const length = view.getUint32(offset)
        const type = ascii(bytes, offset + 4, 4)
        const data = bytes.subarray(offset + 8, offset + 8 + length)
        offset += 12 + length

        if (type === 'IEND') break
        if (type === 'eXIf') result.exifDescription = readTiffDescription(data)
        if (type !== 'tEXt' && type !== 'zTXt' && type !== 'iTXt') continue

        const chunk = await readTextChunk(type, data).catch(() => null)
        if (!chunk) continue
        if (chunk.keyword === XMP_KEYWORD) result.xmp = chunk.text
        else result.text[chunk.keyword] = chunk.text
    }
    return result
}

function readWebp(bytes: Uint8Array): EmbeddedMetadata {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const result: EmbeddedMetadata = { text: {}, exifDescription: null, xmp: null }

    for (let offset = 12; offset + 8 <= bytes.length;) {
        const type = ascii(bytes, offset, 4)
        const length = view.getUint32(offset + 4, true)
        const data = bytes.subarray(offset + 8, offset + 8 + length)
        offset += 8 + length + (length % 2)

        if (type === 'EXIF') result.exifDescription = readTiffDescription(data)
        if (type === 'XMP ') result.xmp = utf8.decode(data)
    }
    return result
}

function findXmp(bytes: Uint8Array) {
    const text = bytewise.decode(bytes)
    const start = text.indexOf(XMP_START)
    const end = start === -1 ? -1 : text.indexOf(XMP_END, start)
    return end === -1 ? null : utf8.decode(bytes.subarray(start, end + XMP_END.length))
}

/** Reads PNG text chunks, EXIF and XMP; other containers (AVIF, JPEG) only yield XMP. */
export async function readEmbeddedMetadata(bytes: Uint8Array): Promise<EmbeddedMetadata> {
    if (isPng(bytes)) return readPng(bytes)
    if (isWebp(bytes)) return readWebp(bytes)
    return { text: {}, exifDescription: null, xmp: findXmp(bytes) }
}

/**
 * Decodes NovelAI's "stealth" metadata from RGBA pixels: alpha LSBs read column by column, holding
 * a 15-byte magic, a 32-bit payload length in bits, then the payload (gzip for `stealth_pngcomp`).
 */
export async function decodeStealthMetadata(
    rgba: ArrayLike<number>,
    width: number,
    height: number,
) {
    const bit = (index: number) => {
        const x = Math.floor(index / height)
        const y = index % height
        return rgba[(y * width + x) * 4 + 3] & 1
    }
    const readBytes = (start: number, count: number) => {
        const bytes = new Uint8Array(count)
        for (let index = 0; index < count * 8; index++) {
            bytes[index >> 3] |= bit(start + index) << (7 - (index & 7))
        }
        return bytes
    }

    const headerBits = STEALTH_MAGIC_BITS + STEALTH_LENGTH_BITS
    if (width * height < headerBits) return null
    const magic = ascii(readBytes(0, STEALTH_MAGIC_BITS / 8), 0, STEALTH_MAGIC_BITS / 8)
    if (magic !== 'stealth_pnginfo' && magic !== 'stealth_pngcomp') return null

    const length = new DataView(readBytes(STEALTH_MAGIC_BITS, 4).buffer).getUint32(0)
    if (length === 0 || headerBits + length > width * height) return null

    const payload = readBytes(headerBits, Math.floor(length / 8))
    const data = magic === 'stealth_pngcomp' ? await decompress(payload, 'gzip') : payload
    return utf8.decode(data)
}

/** Reads stealth metadata through a canvas; alpha is read unpremultiplied so its LSBs survive. */
export async function readStealthMetadata(file: Blob) {
    const bitmap = await createImageBitmap(file, {
        premultiplyAlpha: 'none',
        colorSpaceConversion: 'none',
    })
    try {
        const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d')
        if (!context) return null
        context.drawImage(bitmap, 0, 0)
        const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height)
        return await decodeStealthMetadata(data, bitmap.width, bitmap.height)
    } finally {
        bitmap.close()
    }
}
