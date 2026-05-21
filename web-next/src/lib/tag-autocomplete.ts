import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { BASE_URL } from './api'

type TagSuggestion = {
    id: number
    alias: string
    tag: string
    category: number
    priority: number
}

const DELIMITERS = new Set([',', '{', '}', '[', ']', '|', '\n'])

export async function tagCompletionSource(
    context: CompletionContext,
): Promise<CompletionResult | null> {
    const { state, pos } = context
    const line = state.doc.lineAt(pos)
    const textBefore = line.text.slice(0, pos - line.from)

    let tokenStart = 0
    for (let i = textBefore.length - 1; i >= 0; i--) {
        if (DELIMITERS.has(textBefore[i])) {
            tokenStart = i + 1
            break
        }
    }

    const tokenText = textBefore.slice(tokenStart)
    const trimmed = tokenText.trimStart()
    if (!trimmed || (!context.explicit && trimmed.length < 2)) return null

    const from = line.from + tokenStart + (tokenText.length - trimmed.length)

    try {
        const res = await fetch(
            `${BASE_URL}/tags/autocomplete?q=${encodeURIComponent(trimmed)}&limit=20`,
        )
        if (!res.ok) return null
        const data = (await res.json()) as TagSuggestion[]
        if (!data.length) return null

        return {
            from,
            filter: false,
            options: data.map((item) => ({
                label: item.tag,
                detail: item.alias !== item.tag ? `← ${item.alias}` : undefined,
                boost: Math.log10(item.priority + 1),
                type: 'keyword',
            })),
        }
    } catch {
        return null
    }
}
