import { describe, expect, it } from 'bun:test'
import { normalizePromptVariables } from '@nai-factory/shared'
import { compilePrompts, compileVariables, PromptRenderError } from '../../src/services'

describe('prompt variables', () => {
    it('normalizes legacy object variables while preserving entry order', () => {
        expect(normalizePromptVariables({ first: '1girl', second: 'blue eyes' })).toEqual([
            { key: 'first', value: '1girl' },
            { key: 'second', value: 'blue eyes' },
        ])
    })
})

describe('prompt rendering', () => {
    const source = {
        prompt: '',
        negativePrompt: '',
        characterPrompts: [],
    }

    function requireFirst<T>(items: T[]): T {
        const item = items[0]
        if (!item) throw new Error('Expected at least one item')
        return item
    }

    it('interpolates <<variables>> with Handlebars', () => {
        const prompt = requireFirst(
            compilePrompts(
                { ...source, prompt: 'portrait, <<subject>>' },
                compileVariables([], [], [[{ key: 'subject', value: 'catgirl' }]]),
            ),
        )

        expect(prompt.prompt).toBe('portrait, catgirl')
    })

    it('keeps literal {{variables}} untouched', () => {
        const prompt = requireFirst(
            compilePrompts(
                { ...source, prompt: 'literal {{subject}}, rendered <<subject>>' },
                compileVariables([], [], [[{ key: 'subject', value: 'catgirl' }]]),
            ),
        )

        expect(prompt.prompt).toBe('literal {{subject}}, rendered catgirl')
    })

    it('supports built-in Handlebars blocks through <<...>> delimiters', () => {
        const prompt = requireFirst(
            compilePrompts(
                { ...source, prompt: 'base<<#if extra>>, <<extra>><</if>>' },
                compileVariables([], [], [[{ key: 'extra', value: 'smile' }]]),
            ),
        )

        expect(prompt.prompt).toBe('base, smile')
    })

    it('renders missing variables as an empty string', () => {
        const prompt = requireFirst(
            compilePrompts(
                { ...source, prompt: 'before <<missing>> after' },
                compileVariables([], [], [[]]),
            ),
        )

        expect(prompt.prompt).toBe('before  after')
    })

    it('expands nested variable values within the fixed pass limit', () => {
        const prompt = requireFirst(
            compilePrompts(
                { ...source, prompt: '<<outer>>' },
                compileVariables(
                    [],
                    [],
                    [
                        [
                            { key: 'outer', value: '<<inner>>' },
                            { key: 'inner', value: 'glowing eyes' },
                        ],
                    ],
                ),
            ),
        )

        expect(prompt.prompt).toBe('glowing eyes')
    })

    it('throws readable render errors for invalid templates', () => {
        expect(() =>
            compilePrompts(
                { ...source, prompt: '<<#if subject>>missing close' },
                compileVariables([], [], [[{ key: 'subject', value: 'catgirl' }]]),
            ),
        ).toThrow(PromptRenderError)
    })
})
