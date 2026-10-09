import { useCallback, useRef, useState } from 'react'

import { mergePatch, useDebouncedPatch } from './use-debounced-patch'

interface AutosaveOptions<T, P> {
    /** The server's copy, usually `useQuery(...).data`. */
    data: T | undefined
    /** Sends a patch and writes the response to the query cache. */
    save: (patch: P) => Promise<unknown>
    delay?: number
}

/** Edits overlay `data` until saved; saves run serially. Key the owner by the entity id. */
export function useAutosave<T extends object, P extends object>({
    data,
    save,
    delay,
}: AutosaveOptions<T, P>) {
    const [overlay, setOverlay] = useState<P | null>(null)
    const [savingCount, setSavingCount] = useState(0)
    const editVersion = useRef(0)
    const failedPatch = useRef<P | null>(null)
    const lastSave = useRef<Promise<void>>(Promise.resolve())

    const send = useCallback(
        (patch: P) => {
            const sentVersion = editVersion.current
            const body = failedPatch.current ? mergePatch(failedPatch.current, patch) : patch
            failedPatch.current = null
            setSavingCount((count) => count + 1)

            lastSave.current = lastSave.current
                .then(() => save(body))
                .then(
                    () => {
                        if (editVersion.current === sentVersion && !failedPatch.current) {
                            setOverlay(null)
                        }
                    },
                    () => {
                        failedPatch.current = failedPatch.current
                            ? mergePatch(body, failedPatch.current)
                            : body
                    },
                )
                .finally(() => setSavingCount((count) => count - 1))
        },
        [save],
    )
    const pending = useDebouncedPatch(send, delay)

    function update(patch: P, options?: { immediate?: boolean }) {
        editVersion.current += 1
        setOverlay((current) => mergePatch(current, patch))
        pending.schedule(patch)
        if (options?.immediate) pending.flush()
    }

    const value =
        data && overlay ? (mergePatch<object>(data, overlay) as T) : (data as T | undefined)

    return { value, update, flush: pending.flush, isSaving: savingCount > 0 }
}
