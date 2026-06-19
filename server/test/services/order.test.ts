import { describe, expect, it } from 'bun:test'
import { HTTPException } from 'hono/http-exception'
import { planDisplayOrderUpdate } from '../../src/services'

const items = [
    { id: 1, displayOrder: 'a0' },
    { id: 2, displayOrder: 'a1' },
    { id: 3, displayOrder: 'a2' },
]

describe('display order service', () => {
    it('plans a single fractional order update while the generated key is short enough', () => {
        const plan = planDisplayOrderUpdate({
            entity: 'scene',
            items,
            id: 3,
            prevId: null,
            nextId: 1,
            maxLength: 3,
        })

        expect(plan).toMatchObject({ type: 'single' })
    })

    it('plans a full rebalance when the generated key reaches the length threshold', () => {
        const plan = planDisplayOrderUpdate({
            entity: 'scene',
            items,
            id: 3,
            prevId: null,
            nextId: 1,
            maxLength: 2,
        })

        expect(plan?.type).toBe('rebalance')
        if (!plan || plan.type !== 'rebalance') throw new Error('Expected rebalance plan')
        expect(plan.updates).toEqual([
            { id: 3, displayOrder: 'a0' },
            { id: 1, displayOrder: 'a1' },
            { id: 2, displayOrder: 'a2' },
        ])
        expect(plan.displayOrder).toBe('a0')
    })

    it('rejects neighbors outside the current ordered collection', () => {
        expect(() =>
            planDisplayOrderUpdate({
                entity: 'scene',
                items,
                id: 3,
                prevId: 100,
                nextId: null,
            }),
        ).toThrow(HTTPException)
    })
})
