import { useEffect, useState } from 'react'

import { debounce } from '@/lib/utils'

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Merges patches the way the server does: nested objects merge, everything else replaces. */
export function mergePatch<T>(base: T | null, patch: T): T {
    if (!isPlainObject(base) || !isPlainObject(patch)) return patch
    const result: Record<string, unknown> = { ...base }
    for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) continue
        result[key] = mergePatch(result[key], value)
    }
    return result as T
}

function createPatchQueue<T>(initialSave: (patch: T) => void, delay: number) {
    let pending: T | null = null
    let save = initialSave
    const run = debounce(() => {
        const patch = pending
        pending = null
        if (patch) save(patch)
    }, delay)

    return {
        setSave(next: (patch: T) => void) {
            save = next
        },
        schedule(patch: T) {
            pending = mergePatch(pending, patch)
            run()
        },
        flush: () => run.flush(),
        cancel() {
            pending = null
            run.cancel()
        },
    }
}

/** Merges queued updates so only changed fields are sent; pending ones save on unmount. */
export function useDebouncedPatch<T extends object>(save: (patch: T) => void, delay = 600) {
    const [queue] = useState(() => createPatchQueue(save, delay))

    useEffect(() => queue.setSave(save), [queue, save])
    useEffect(() => () => queue.flush(), [queue])

    return queue
}
