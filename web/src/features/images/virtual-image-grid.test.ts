import { describe, expect, it } from 'vitest'

import { gridLayout, rowHeights } from './virtual-image-grid'

describe('gridLayout', () => {
    it('fits as many 160px columns as the width allows', () => {
        expect(gridLayout(160).columns).toBe(1)
        expect(gridLayout(331).columns).toBe(1)
        expect(gridLayout(332).columns).toBe(2)
        expect(gridLayout(1000).columns).toBe(5)
    })

    it('keeps one column when the width is below the minimum', () => {
        expect(gridLayout(100)).toEqual({ columns: 1, columnWidth: 100 })
    })

    it('stretches the columns to fill the width', () => {
        expect(gridLayout(1000).columnWidth).toBeCloseTo((1000 - 12 * 4) / 5)
    })
})

describe('rowHeights', () => {
    it('sizes each row by its narrowest item', () => {
        expect(rowHeights([1.5, 0.5, 1, 2, 2], 2, 100)).toEqual([200, 100, 50])
    })

    it('returns no rows without items', () => {
        expect(rowHeights([], 3, 100)).toEqual([])
    })
})
