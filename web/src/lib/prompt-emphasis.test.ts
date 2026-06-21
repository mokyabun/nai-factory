import { describe, expect, it } from 'vitest'
import { parsePromptEmphasisRanges } from './prompt-emphasis'

function highlightedText(prompt: string) {
    return parsePromptEmphasisRanges(prompt).map((range) => ({
        text: prompt.slice(range.from, range.to),
        kind: range.kind,
    }))
}

describe('prompt emphasis highlighting', () => {
    it('highlights numeric emphasis above and below neutral weight', () => {
        const prompt = '1.4::cat::, 0.8::blue hair::, dog'

        expect(highlightedText(prompt)).toEqual([
            { text: '1.4::cat', kind: 'high' },
            { text: '0.8::blue hair', kind: 'low' },
        ])
    })

    it('highlights legacy brace emphasis', () => {
        const prompt = 'cat, {red hair}, [small wings]'

        expect(highlightedText(prompt)).toEqual([
            { text: '{red hair', kind: 'high' },
            { text: '[small wings', kind: 'low' },
        ])
    })

    it('treats bare numeric delimiters as closing markers', () => {
        const prompt = '0.7::soft focus::, crisp'

        expect(highlightedText(prompt)).toEqual([{ text: '0.7::soft focus', kind: 'low' }])
    })

    it('lets bare numeric delimiters close open brace emphasis', () => {
        const prompt = '{red hair::, normal'

        expect(highlightedText(prompt)).toEqual([{ text: '{red hair', kind: 'high' }])
    })
})
