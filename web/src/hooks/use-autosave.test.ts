// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAutosave } from './use-autosave'

type Doc = { title: string; body: string; options: { size: number; color: string } }
type DocPatch = { title?: string; body?: string; options?: { size?: number; color?: string } }

const doc: Doc = { title: 'a', body: 'b', options: { size: 1, color: 'red' } }

// React only batches `act` updates when told it runs in a test environment.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

type Autosave = ReturnType<typeof useAutosave<Doc, DocPatch>>

function Probe({
    data,
    save,
    report,
}: {
    data: Doc
    save: (patch: DocPatch) => Promise<unknown>
    report: (autosave: Autosave) => void
}) {
    report(useAutosave<Doc, DocPatch>({ data, save }))
    return null
}

function renderAutosave(initial: Doc, save: (patch: DocPatch) => Promise<unknown>) {
    const result = { current: null as unknown as Autosave }
    const report = (autosave: Autosave) => {
        result.current = autosave
    }
    const root = createRoot(document.createElement('div'))
    const render = (data: Doc) =>
        act(() => root.render(createElement(Probe, { data, save, report })))
    render(initial)
    return { result, render, unmount: () => act(() => root.unmount()) }
}

describe('useAutosave', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    it('shows edits at once and sends them merged after the pause', async () => {
        const save = vi.fn(() => Promise.resolve())
        const { result } = renderAutosave(doc, save)

        act(() => result.current.update({ title: 'x' }))
        act(() => result.current.update({ options: { size: 2 } }))

        expect(result.current.value).toEqual({
            ...doc,
            title: 'x',
            options: { size: 2, color: 'red' },
        })
        expect(save).not.toHaveBeenCalled()

        await act(() => vi.advanceTimersByTimeAsync(600))
        expect(save).toHaveBeenCalledExactlyOnceWith({ title: 'x', options: { size: 2 } })
    })

    it('follows the server copy again once the save lands', async () => {
        const { result, render } = renderAutosave(doc, () => Promise.resolve())

        act(() => result.current.update({ title: 'x' }))
        await act(() => vi.advanceTimersByTimeAsync(600))
        render({ ...doc, title: 'x', body: 'from server' })

        expect(result.current.value).toEqual({ ...doc, title: 'x', body: 'from server' })
        render({ ...doc, title: 'changed elsewhere' })
        expect(result.current.value?.title).toBe('changed elsewhere')
    })

    it('keeps edits made while a save is in flight', async () => {
        let finish = () => {}
        const save = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)))
        const { result } = renderAutosave(doc, save)

        act(() => result.current.update({ title: 'x' }))
        await act(() => vi.advanceTimersByTimeAsync(600))
        act(() => result.current.update({ body: 'y' }))
        await act(async () => finish())

        expect(result.current.value).toMatchObject({ title: 'x', body: 'y' })
    })

    it('resends a failed patch with the next change', async () => {
        const save = vi
            .fn<(patch: DocPatch) => Promise<unknown>>()
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValue(undefined)
        const { result } = renderAutosave(doc, save)

        act(() => result.current.update({ title: 'x' }))
        await act(() => vi.advanceTimersByTimeAsync(600))
        expect(result.current.value?.title).toBe('x')

        act(() => result.current.update({ body: 'y' }))
        await act(() => vi.advanceTimersByTimeAsync(600))
        expect(save).toHaveBeenLastCalledWith({ title: 'x', body: 'y' })
    })

    it('saves at once on request and on unmount', async () => {
        const save = vi.fn(() => Promise.resolve())
        const { result, unmount } = renderAutosave(doc, save)

        act(() => result.current.update({ title: 'x' }, { immediate: true }))
        await act(() => vi.advanceTimersByTimeAsync(0))
        expect(save).toHaveBeenCalledWith({ title: 'x' })

        act(() => result.current.update({ body: 'y' }))
        unmount()
        await vi.advanceTimersByTimeAsync(0)
        expect(save).toHaveBeenLastCalledWith({ body: 'y' })
    })
})
