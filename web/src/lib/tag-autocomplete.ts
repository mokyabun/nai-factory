import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { api } from './api'

// Delimiters that separate tags in a NAI prompt
const DELIMITERS = new Set([',', '{', '}', '[', ']', '|', '\n'])

export async function tagCompletionSource(
    context: CompletionContext,
): Promise<CompletionResult | null> {
    const { state, pos } = context
    const line = state.doc.lineAt(pos)
    const textBefore = line.text.slice(0, pos - line.from)

    // Find the start of the current token by scanning backwards for a delimiter
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
        const { data, error } = await api.tags.autocomplete.get({
            query: { q: trimmed, limit: 20 },
        })
        if (error || !data?.length) return null

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
