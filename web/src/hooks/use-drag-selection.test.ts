// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import { applyDragRange, type DragRange, useDragSelection } from './use-drag-selection'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const items = [{ id: 10 }, { id: 20 }, { id: 30 }, { id: 40 }, { id: 50 }]

function drag(
    startIndex: number,
    action: DragRange['action'],
    baseSelectedIds: number[],
    targetIndex: number,
) {
    const next = applyDragRange(
        items,
        { startIndex, action, baseSelectedIds: new Set(baseSelectedIds) },
        targetIndex,
    )
    return [...next].sort((a, b) => a - b)
}

describe('applyDragRange', () => {
    it('selects the start item alone before the pointer moves', () => {
        expect(drag(2, 'select', [], 2)).toEqual([30])
    })

    it('selects every item between start and target in either direction', () => {
        expect(drag(1, 'select', [], 3)).toEqual([20, 30, 40])
        expect(drag(3, 'select', [], 1)).toEqual([20, 30, 40])
    })

    it('keeps the base selection outside the range', () => {
        expect(drag(3, 'select', [10], 4)).toEqual([10, 40, 50])
    })

    it('deselects the range from the base selection', () => {
        expect(drag(1, 'deselect', [10, 20, 30, 40, 50], 3)).toEqual([10, 50])
    })

    it('shrinks back to the base when the pointer returns toward the start', () => {
        expect(drag(0, 'select', [50], 3)).toEqual([10, 20, 30, 40, 50])
        expect(drag(0, 'select', [50], 1)).toEqual([10, 20, 50])
    })

    it('clamps targets outside the list', () => {
        expect(drag(3, 'select', [], 99)).toEqual([40, 50])
        expect(drag(1, 'select', [], -5)).toEqual([10, 20])
    })

    it('does not mutate the base selection', () => {
        const base = new Set([10])
        applyDragRange(items, { startIndex: 0, action: 'deselect', baseSelectedIds: base }, 2)
        expect([...base]).toEqual([10])
    })
})

type DragSelection = ReturnType<typeof useDragSelection>

function Probe({ report }: { report: (selection: DragSelection) => void }) {
    report(useDragSelection(items))
    return null
}

const unmounts: (() => void)[] = []

function renderSelection() {
    const result = { current: null as unknown as DragSelection }
    const root = createRoot(document.createElement('div'))
    unmounts.push(() => act(() => root.unmount()))
    act(() =>
        root.render(
            createElement(Probe, {
                report: (selection) => {
                    result.current = selection
                },
            }),
        ),
    )
    return result
}

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = window) {
    act(() => {
        target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }))
    })
}

describe('useDragSelection', () => {
    afterEach(() => {
        for (const unmount of unmounts.splice(0)) unmount()
    })

    it('drags a range from the start item and ends on pointerup', () => {
        const result = renderSelection()

        act(() => result.current.selectDragStart(1, false))
        act(() => result.current.selectDragEnter(3))
        expect(result.current.orderedSelectedIds).toEqual([20, 30, 40])

        act(() => {
            window.dispatchEvent(new Event('pointerup'))
        })
        act(() => result.current.selectDragEnter(4))
        expect(result.current.orderedSelectedIds).toEqual([20, 30, 40])
    })

    it('deselects when the drag starts on a selected item', () => {
        const result = renderSelection()

        act(() => result.current.selectAll())
        act(() => result.current.selectDragStart(2, true))
        act(() => result.current.selectDragEnter(3))
        expect(result.current.orderedSelectedIds).toEqual([10, 20, 50])
    })

    it('selects all with Ctrl/Cmd+A and clears with Escape', () => {
        const result = renderSelection()

        press('a', { metaKey: true })
        expect(result.current.orderedSelectedIds).toEqual([10, 20, 30, 40, 50])
        press('Escape')
        expect(result.current.orderedSelectedIds).toEqual([])
        press('A', { ctrlKey: true })
        expect(result.current.orderedSelectedIds).toHaveLength(5)
    })

    it('ignores shortcuts while typing in an input', () => {
        const result = renderSelection()
        const input = document.body.appendChild(document.createElement('input'))

        press('a', { ctrlKey: true }, input)
        expect(result.current.orderedSelectedIds).toEqual([])
        input.remove()
    })

    it('takes the given ids and restores the previous selection', () => {
        const result = renderSelection()

        act(() => result.current.selectAll())
        let restore = () => {}
        act(() => {
            restore = result.current.take([20, 40])
        })
        expect(result.current.orderedSelectedIds).toEqual([10, 30, 50])

        act(() => restore())
        expect(result.current.orderedSelectedIds).toEqual([10, 20, 30, 40, 50])

        act(() => {
            result.current.take()
        })
        expect(result.current.orderedSelectedIds).toEqual([])
    })
})
