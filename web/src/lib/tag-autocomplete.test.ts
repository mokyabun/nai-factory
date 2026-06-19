import { CompletionContext } from '@codemirror/autocomplete'
import { EditorState } from '@codemirror/state'
import { describe, expect, it, vi } from 'vitest'
import { api } from './api'
import { createPromptCompletionSource, tagCompletionSource } from './tag-autocomplete'

vi.mock('./api', () => ({
    api: {
        tags: {
            autocomplete: {
                get: vi.fn(async () => ({
                    data: [{ id: 1, alias: 'cats', tag: 'cat', category: 0, priority: 100 }],
                    error: null,
                })),
            },
        },
    },
}))

function completionContext(doc: string, explicit = false) {
    return new CompletionContext(EditorState.create({ doc }), doc.length, explicit)
}

describe('prompt autocomplete', () => {
    it('suggests variables inside NAI template delimiters', async () => {
        const source = createPromptCompletionSource([
            { key: 'subject', value: 'catgirl' },
            { key: 'style', value: 'watercolor' },
        ])

        const result = await source(completionContext('portrait, <<su'))

        expect(result?.from).toBe('portrait, <<'.length)
        expect(result?.options.map((option) => option.label)).toEqual(['subject', 'style'])
    })

    it('deduplicates and ignores blank variable keys', async () => {
        const source = createPromptCompletionSource([
            { key: ' subject ', value: 'catgirl' },
            { key: 'subject', value: 'duplicate' },
            { key: ' ', value: 'blank' },
        ])

        const result = await source(completionContext('<<', true))

        expect(result?.options.map((option) => option.label)).toEqual(['subject'])
    })

    it('completes tags inside weighted NAI syntax', async () => {
        const state = EditorState.create({ doc: '0.5::ca' })
        const result = await tagCompletionSource(
            new CompletionContext(state, state.doc.length, false),
        )

        expect(api.tags.autocomplete.get).toHaveBeenCalledWith({
            query: { q: 'ca', limit: 20 },
        })
        expect(result?.from).toBe('0.5::'.length)
        expect(result?.options[0]?.label).toBe('cat')

        let nextDoc = state.doc.toString()
        const apply = result?.options[0]?.apply
        expect(typeof apply).toBe('function')
        if (typeof apply === 'function') {
            apply(
                {
                    state,
                    dispatch: (spec) => {
                        nextDoc = state.update(spec).state.doc.toString()
                    },
                } as never,
                result.options[0],
                result.from,
                state.doc.length,
            )
        }

        expect(nextDoc).toBe('0.5::cat::')
    })
})
