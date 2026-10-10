import { Unzip, UnzipInflate, Zip, ZipDeflate, ZipPassThrough } from 'fflate'

export type ZipEntry = {
    name: string
    data: Uint8Array
    /** Already-compressed formats (PNG, WebP…) are stored without deflate. */
    compress: boolean
}

/** Pulls one entry at a time so only the current file is held in memory. */
export function createZipStream(entries: AsyncIterable<ZipEntry>): ReadableStream<Uint8Array> {
    const iterator = entries[Symbol.asyncIterator]()
    let zip: Zip | null = null

    return new ReadableStream<Uint8Array>({
        start(controller) {
            zip = new Zip((error, chunk, final) => {
                if (error) {
                    controller.error(error)
                    return
                }
                controller.enqueue(chunk)
                if (final) controller.close()
            })
        },
        async pull(controller) {
            try {
                const next = await iterator.next()
                if (next.done) {
                    zip?.end()
                    return
                }
                const file = next.value.compress
                    ? new ZipDeflate(next.value.name, { level: 6 })
                    : new ZipPassThrough(next.value.name)
                zip?.add(file)
                file.push(next.value.data, true)
            } catch (error) {
                controller.error(error)
            }
        },
        async cancel() {
            zip?.terminate()
            await iterator.return?.()
        },
    })
}

export class ZipLimitError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'ZipLimitError'
    }
}

export type UnzipOptions = {
    maxEntries: number
    maxTotalBytes: number
    /** Throw to reject an entry name. */
    checkName(name: string): void
    onEntry(name: string, data: Uint8Array): Promise<void>
}

function concat(chunks: Uint8Array[], size: number) {
    const result = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
        result.set(chunk, offset)
        offset += chunk.byteLength
    }
    return result
}

/** Enforces entry count and total size limits while inflating (zip bomb protection). */
export async function readZipStream(source: ReadableStream<Uint8Array>, options: UnzipOptions) {
    let failure: unknown = null
    let entries = 0
    let total = 0
    let pending = Promise.resolve()

    const fail = (error: unknown) => {
        failure ??= error
    }

    const unzip = new Unzip((file) => {
        if (failure) return
        if (file.name.endsWith('/')) return
        entries += 1
        if (entries > options.maxEntries) {
            fail(new ZipLimitError(`Archive has more than ${options.maxEntries} entries`))
            return
        }
        try {
            options.checkName(file.name)
        } catch (error) {
            fail(error)
            return
        }

        const chunks: Uint8Array[] = []
        let size = 0
        file.ondata = (error, chunk, final) => {
            if (failure) return
            if (error) {
                fail(error)
                return
            }
            size += chunk.byteLength
            total += chunk.byteLength
            if (total > options.maxTotalBytes) {
                fail(new ZipLimitError('Archive is larger than the allowed uncompressed size'))
                file.terminate()
                return
            }
            chunks.push(chunk)
            if (final) {
                const data = concat(chunks, size)
                pending = pending
                    .then(() => (failure ? undefined : options.onEntry(file.name, data)))
                    .catch(fail)
            }
        }
        file.start()
    })
    unzip.register(UnzipInflate)

    const reader = source.getReader()
    try {
        while (!failure) {
            const { done, value } = await reader.read()
            if (done) break
            unzip.push(value)
        }
        if (!failure) unzip.push(new Uint8Array(0), true)
    } catch (error) {
        fail(error)
    } finally {
        reader.releaseLock()
    }

    await pending
    if (failure) throw failure
    return { entries, totalBytes: total }
}
