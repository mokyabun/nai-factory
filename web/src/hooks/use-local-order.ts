import { useState } from 'react'

const EMPTY: never[] = []

/** Shows the dragged order until `source` changes with the move's cache update or refetch. */
export function useLocalOrder<T>(source: T[] | undefined) {
    const [local, setLocal] = useState<{ source: T[] | undefined; items: T[] } | null>(null)
    const items = local && local.source === source ? local.items : (source ?? EMPTY)

    function setOrder(next: T[]) {
        setLocal({ source, items: next })
    }

    return [items, setOrder] as const
}
