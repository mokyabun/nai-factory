import { randomBytes } from 'node:crypto'

export type MultipartPart = {
    name: string
    filename: string
    contentType: string
    data: Uint8Array
}

/** Builds a multipart/form-data body the way NovelAI's web client does. */
export function createMultipartBody(parts: MultipartPart[]) {
    const boundary = `----WebKitFormBoundary${randomBytes(12).toString('base64url')}`
    const chunks: Buffer[] = []

    for (const part of parts) {
        chunks.push(
            Buffer.from(
                [
                    `--${boundary}`,
                    `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"`,
                    `Content-Type: ${part.contentType}`,
                    '',
                    '',
                ].join('\r\n'),
            ),
            Buffer.from(part.data),
            Buffer.from('\r\n'),
        )
    }

    chunks.push(Buffer.from(`--${boundary}--\r\n`))

    return {
        body: Buffer.concat(chunks),
        contentType: `multipart/form-data; boundary=${boundary}`,
    }
}
