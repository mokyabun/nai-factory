import { describe, expect, it } from 'vitest'
import { reorderById } from './reorder'

const items = [{ id: 1 }, { id: 2 }, { id: 3 }]

describe('reorderById', () => {
    it('moves an item and returns neighboring ids for persistence', () => {
        expect(reorderById(items, 3, 1)).toEqual({
            items: [{ id: 3 }, { id: 1 }, { id: 2 }],
            orderPatch: {
                id: 3,
                prevId: null,
                nextId: 1,
            },
        })
    })

    it('ignores no-op or unknown drag targets', () => {
        expect(reorderById(items, 1, 1)).toBeNull()
        expect(reorderById(items, 1, 99)).toBeNull()
    })
})
