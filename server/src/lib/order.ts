import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing-jittered'

/** Keys longer than this trigger a rebalance of every sibling. */
export const POSITION_REBALANCE_LENGTH = 32

export type Positioned = { id: number; position: string }

export function keyBetween(before: string | null, after: string | null) {
    return generateKeyBetween(before, after)
}

export function keyAfter(last: string | null) {
    return generateKeyBetween(last, null)
}

export function keyBefore(first: string | null) {
    return generateKeyBetween(null, first)
}

export function keysBetween(before: string | null, after: string | null, count: number) {
    return count === 0 ? [] : generateNKeysBetween(before, after, count)
}

export function comparePositioned(a: Positioned, b: Positioned) {
    if (a.position < b.position) return -1
    if (a.position > b.position) return 1
    return a.id - b.id
}

export class MoveError extends Error {
    constructor(
        readonly reason: 'not_found' | 'invalid_neighbors' | 'neighbor_not_found',
        message: string,
    ) {
        super(message)
    }
}

/**
 * Plans the position updates for moving `id` between `beforeId` and `afterId` among `items`.
 * Returns a single update normally, or new keys for every sibling when keys grow too long.
 */
export function planMove(
    items: Positioned[],
    id: number,
    beforeId: number | null,
    afterId: number | null,
    maxLength = POSITION_REBALANCE_LENGTH,
): Positioned[] {
    if (!items.some((item) => item.id === id)) {
        throw new MoveError('not_found', 'Item not found')
    }
    if (beforeId === id || afterId === id || (beforeId !== null && beforeId === afterId)) {
        throw new MoveError('invalid_neighbors', 'Invalid neighbors')
    }

    const others = [...items].sort(comparePositioned).filter((item) => item.id !== id)
    let index = others.length

    if (beforeId !== null) {
        const beforeIndex = others.findIndex((item) => item.id === beforeId)
        if (beforeIndex === -1) throw new MoveError('neighbor_not_found', 'Previous item not found')
        index = beforeIndex + 1
    } else if (afterId !== null) {
        const afterIndex = others.findIndex((item) => item.id === afterId)
        if (afterIndex === -1) throw new MoveError('neighbor_not_found', 'Next item not found')
        index = afterIndex
    }

    return placeAt(others, id, index, maxLength)
}

function placeAt(others: Positioned[], id: number, index: number, maxLength: number) {
    const before = others[index - 1]?.position ?? null
    const after = others[index]?.position ?? null
    // Equal keys (allowed, ordered by id) have no key between them; rebalance instead.
    const position = before !== null && before === after ? null : safeKeyBetween(before, after)

    if (position !== null && position.length < maxLength) return [{ id, position }]

    const reordered = [...others.slice(0, index), { id, position: '' }, ...others.slice(index)]
    const keys = keysBetween(null, null, reordered.length)
    return reordered.map((item, i) => ({ id: item.id, position: keys[i] as string }))
}

function safeKeyBetween(before: string | null, after: string | null) {
    if (before !== null && after !== null && before > after) return null
    try {
        return keyBetween(before, after)
    } catch {
        return null
    }
}
