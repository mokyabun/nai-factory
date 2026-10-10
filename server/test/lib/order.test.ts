import { describe, expect, it } from 'bun:test'

import { comparePositioned, keysBetween, MoveError, planMove, type Positioned } from '@/lib/order'

function apply(items: Positioned[], updates: Positioned[]) {
    const byId = new Map(updates.map((update) => [update.id, update.position]))
    return items
        .map((item) => ({ ...item, position: byId.get(item.id) ?? item.position }))
        .sort(comparePositioned)
        .map((item) => item.id)
}

const [k0, k1, k2] = keysBetween(null, null, 3) as [string, string, string]
const items = [
    { id: 1, position: k0 },
    { id: 2, position: k1 },
    { id: 3, position: k2 },
]

describe('planMove', () => {
    it('moves an item to the front', () => {
        expect(apply(items, planMove(items, 3, null, 1))).toEqual([3, 1, 2])
    })

    it('moves an item between two siblings', () => {
        expect(apply(items, planMove(items, 1, 2, 3))).toEqual([2, 1, 3])
    })

    it('moves an item to the end', () => {
        expect(apply(items, planMove(items, 1, 3, null))).toEqual([2, 3, 1])
    })

    it('updates only the moved item normally', () => {
        expect(planMove(items, 1, 2, 3)).toHaveLength(1)
    })

    it('rebalances siblings with equal positions', () => {
        const equal = [
            { id: 1, position: 'a0' },
            { id: 2, position: 'a0' },
            { id: 3, position: 'a0' },
        ]
        const updates = planMove(equal, 3, 1, 2)
        expect(updates).toHaveLength(3)
        expect(apply(equal, updates)).toEqual([1, 3, 2])
    })

    it('rebalances when keys grow too long', () => {
        let current = [...items]
        for (let i = 0; i < 60; i++) {
            const updates = planMove(current, 3, 1, 2)
            current = current.map((item) => ({
                ...item,
                position:
                    updates.find((update) => update.id === item.id)?.position ?? item.position,
            }))
            const moved = planMove(current, 3, 2, null)
            current = current.map((item) => ({
                ...item,
                position: moved.find((update) => update.id === item.id)?.position ?? item.position,
            }))
        }
        expect(Math.max(...current.map((item) => item.position.length))).toBeLessThan(33)
    })

    it('rejects unknown items and invalid neighbors', () => {
        expect(() => planMove(items, 9, null, null)).toThrow(MoveError)
        expect(() => planMove(items, 1, 1, null)).toThrow(MoveError)
        expect(() => planMove(items, 1, 9, null)).toThrow(MoveError)
    })
})
