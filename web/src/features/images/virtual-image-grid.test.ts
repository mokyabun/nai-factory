import { describe, expect, it } from 'vitest'

import { gridLayout } from './virtual-image-grid'

describe('gridLayout', () => {
    it('fits as many 160px columns as the width allows', () => {
        expect(gridLayout(160).columns).toBe(1)
        expect(gridLayout(331).columns).toBe(1)
        expect(gridLayout(332).columns).toBe(2)
        expect(gridLayout(1000).columns).toBe(5)
    })

    it('keeps one column when the width is below the minimum', () => {
        const layout = gridLayout(100)
        expect(layout.columns).toBe(1)
        expect(layout.itemHeight).toBeCloseTo((100 * 4) / 3)
    })

    it('makes items 3:4 at the stretched column width', () => {
        expect(gridLayout(1000).itemHeight).toBeCloseTo(((1000 - 12 * 4) / 5) * (4 / 3))
    })
})
