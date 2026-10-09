import { useState } from 'react'

const EMPTY: never[] = []

/**
 * A server-ordered list that a drag can reorder right away. The dragged order is shown until
 * `source` changes, which happens when the move's optimistic cache update or refetch lands.
 */
export function useLocalOrder<T>(source: T[] | undefined) {
    const [local, setLocal] = useState<{ source: T[] | undefined; items: T[] } | null>(null)
    const items = local && local.source === source ? local.items : (source ?? EMPTY)

    function setOrder(next: T[]) {
        setLocal({ source, items: next })
    }

    return [items, setOrder] as const
}
